package handlers

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"mailbag/internal/config"
	"mailbag/internal/db"
	"mailbag/internal/mailer"
)

// testServer boots the full route table on an in-memory SQLite database.
// SMTP is unconfigured, so the mailer logs and skips sends.
func testServer(t *testing.T) (*httptest.Server, *sql.DB) {
	t.Helper()
	d, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	d.SetMaxOpenConns(1) // :memory: is per-connection; keep a single database
	if err := db.EnsureSchema(d); err != nil {
		t.Fatalf("schema: %v", err)
	}
	cfg := config.Config{BaseURL: "http://api.test"}
	m := mailer.New(cfg)
	p := NewPublic(d, m, cfg)
	a := NewAdmin(d, m, cfg.BaseURL, "sekrit", "")
	mux := http.NewServeMux()
	p.Routes(mux)
	a.Routes(mux)
	s := httptest.NewServer(mux)
	t.Cleanup(s.Close)
	return s, d
}

func createList(t *testing.T, d *sql.DB, id, listType string) {
	t.Helper()
	if _, err := d.Exec(`INSERT INTO lists(id, name, type, sender_name, sender_email, provider)
		VALUES(?, 'Test List', ?, 'Tester', 'hello@test.dev', 'smtp')`, id, listType); err != nil {
		t.Fatalf("create list: %v", err)
	}
}

func postJSON(t *testing.T, s *httptest.Server, path, body string) (int, string) {
	t.Helper()
	resp, err := s.Client().Post(s.URL+path, "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

func contactStatus(t *testing.T, d *sql.DB, listID, email string) string {
	t.Helper()
	var status string
	if err := d.QueryRow(`SELECT status FROM contacts WHERE list_id=? AND email=?`, listID, email).Scan(&status); err != nil {
		t.Fatalf("contact status: %v", err)
	}
	return status
}

func TestUnsubscribeURLCarriesParams(t *testing.T) {
	got := unsubscribeURL("http://api.test/", "pk_abc", "user@example.com")
	want := "http://api.test/v1/unsubscribe?list_key=pk_abc&email=user%40example.com"
	if got != want {
		t.Fatalf("unsubscribeURL = %q, want %q", got, want)
	}
}

// Regression: the welcome email's opt-out link used to point at a bare
// /v1/unsubscribe, which the GET handler rejects with 405. Following the
// generated link must unsubscribe the contact.
func TestUnsubscribeLinkFromWelcomeMail(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")

	code, body := postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"user@example.com"}`)
	if code != 200 || !strings.Contains(body, `"pending"`) {
		t.Fatalf("subscribe = %d %s", code, body)
	}

	link := unsubscribeURL("http://api.test", "pk_nl", "user@example.com")
	u, err := url.Parse(link)
	if err != nil {
		t.Fatalf("parse link: %v", err)
	}
	resp, err := s.Client().Get(s.URL + u.RequestURI())
	if err != nil {
		t.Fatalf("GET unsubscribe link: %v", err)
	}
	defer resp.Body.Close()
	page, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 || !strings.Contains(string(page), "Unsubscribed") {
		t.Fatalf("unsubscribe link = %d %s", resp.StatusCode, page)
	}
	if got := contactStatus(t, d, "pk_nl", "user@example.com"); got != "unsubscribed" {
		t.Fatalf("status after link = %q, want unsubscribed", got)
	}
}

func TestSubscribeValidatesInput(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")

	cases := []struct {
		name, body string
		wantCode   int
		wantErr    string
	}{
		{"invalid email", `{"list_key":"pk_nl","email":"not-an-email"}`, 400, "invalid email"},
		{"missing list", `{"list_key":"","email":"a@b.co"}`, 400, "list_key required"},
		{"unknown list", `{"list_key":"pk_nope","email":"a@b.co"}`, 404, "unknown list"},
		{"bad json", `{`, 400, "invalid json"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			code, body := postJSON(t, s, "/v1/subscribe", tc.body)
			if code != tc.wantCode || !strings.Contains(body, tc.wantErr) {
				t.Fatalf("got %d %s, want %d containing %q", code, body, tc.wantCode, tc.wantErr)
			}
		})
	}
}

// Bots that fill the honeypot get a fake success; no contact is written.
func TestSubscribeHoneypot(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")

	code, body := postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"bot@spam.co","website":"http://spam.co"}`)
	if code != 200 || !strings.Contains(body, `"pending"`) {
		t.Fatalf("honeypot = %d %s, want fake pending success", code, body)
	}
	var n int
	_ = d.QueryRow(`SELECT COUNT(*) FROM contacts`).Scan(&n)
	if n != 0 {
		t.Fatalf("honeypot wrote a contact (%d rows)", n)
	}
}

func TestSubscribeWaitlistPosition(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_wl", "waitlist")

	for _, email := range []string{"one@x.co", "two@x.co", "three@x.co"} {
		code, body := postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_wl","email":"`+email+`"}`)
		if code != 200 {
			t.Fatalf("subscribe %s = %d %s", email, code, body)
		}
		var resp struct {
			Status   string `json:"status"`
			Position int    `json:"position"`
		}
		if err := json.Unmarshal([]byte(body), &resp); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if resp.Position < 1 || resp.Position > 3 {
			t.Fatalf("%s position = %d, want 1..3", email, resp.Position)
		}
	}
	// Newsletter lists never report a position.
	createList(t, d, "pk_nl2", "newsletter")
	_, body := postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl2","email":"a@x.co"}`)
	if strings.Contains(body, `"position"`) {
		t.Fatalf("newsletter response reports position: %s", body)
	}
}

func TestConfirmFlow(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"user@example.com"}`)

	var token string
	if err := d.QueryRow(`SELECT token FROM tokens WHERE email='user@example.com'`).Scan(&token); err != nil {
		t.Fatalf("token: %v", err)
	}

	resp, err := s.Client().Get(s.URL + "/v1/confirm?token=" + token)
	if err != nil {
		t.Fatalf("confirm: %v", err)
	}
	page, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || !strings.Contains(string(page), "confirmed") {
		t.Fatalf("confirm = %d %s", resp.StatusCode, page)
	}
	if got := contactStatus(t, d, "pk_nl", "user@example.com"); got != "confirmed" {
		t.Fatalf("status after confirm = %q", got)
	}

	// Token is single-use.
	resp2, err := s.Client().Get(s.URL + "/v1/confirm?token=" + token)
	if err != nil {
		t.Fatalf("confirm replay: %v", err)
	}
	resp2.Body.Close()
	if resp2.StatusCode != 400 {
		t.Fatalf("confirm replay = %d, want 400", resp2.StatusCode)
	}
}

func TestClientIP(t *testing.T) {
	makeReq := func(remote, cf string, xff ...string) *http.Request {
		r := httptest.NewRequest("POST", "/v1/subscribe", nil)
		r.RemoteAddr = remote
		if cf != "" {
			r.Header.Set("CF-Connecting-IP", cf)
		}
		if len(xff) > 0 {
			r.Header.Set("X-Forwarded-For", strings.Join(xff, ", "))
		}
		return r
	}

	cases := []struct {
		name string
		r    *http.Request
		want string
	}{
		// Spoofed leftmost entry must be ignored: Traefik appends the real
		// client, so the rightmost hop names the actual peer.
		{"spoofed leftmost xff", makeReq("10.0.0.9:443", "", "6.6.6.6", "1.2.3.4"), "1.2.3.4"},
		{"multi-hop chain", makeReq("10.0.0.9:443", "", "6.6.6.6", "7.7.7.7", "1.2.3.4"), "1.2.3.4"},
		{"cloudflare wins", makeReq("10.0.0.9:443", "9.9.9.9", "6.6.6.6", "8.8.8.8"), "9.9.9.9"},
		{"direct connection", makeReq("1.2.3.4:5678", "", ""), "1.2.3.4"},
		{"xff without port in remote", makeReq("1.2.3.4", "", "5.5.5.5"), "5.5.5.5"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := clientIP(tc.r); got != tc.want {
				t.Fatalf("clientIP = %q, want %q", got, tc.want)
			}
		})
	}
}

// The limiter buckets per client IP: a spoofed XFF can no longer mint
// unlimited buckets, so bursts from one source are capped.
func TestRateLimitPerClient(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")

	seen429 := false
	for i := 0; i < 25; i++ {
		req, _ := http.NewRequest("POST", s.URL+"/v1/subscribe", strings.NewReader(`{"list_key":"pk_nl","email":"u`+string(rune('a'+i))+`@x.co"}`))
		req.Header.Set("Content-Type", "application/json")
		// Spoofed leftmost entry changes every request; rightmost (Traefik's
		// view) stays the real test client.
		req.Header.Set("X-Forwarded-For", "6.6.6."+string(rune('0'+i))+", 203.0.113.7")
		resp, err := s.Client().Do(req)
		if err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
		resp.Body.Close()
		if resp.StatusCode == 429 {
			seen429 = true
			break
		}
	}
	if !seen429 {
		t.Fatal("25 spoofed-XFF requests never hit the rate limit")
	}
}

func TestAdminAuthRequired(t *testing.T) {
	s, _ := testServer(t)

	resp, err := s.Client().Get(s.URL + "/admin/lists")
	if err != nil {
		t.Fatalf("get lists: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != 401 {
		t.Fatalf("no key = %d, want 401", resp.StatusCode)
	}

	req, _ := http.NewRequest("GET", s.URL+"/admin/lists", nil)
	req.Header.Set("Authorization", "Bearer wrong")
	resp2, err := s.Client().Do(req)
	if err != nil {
		t.Fatalf("bad key: %v", err)
	}
	resp2.Body.Close()
	if resp2.StatusCode != 401 {
		t.Fatalf("bad key = %d, want 401", resp2.StatusCode)
	}
}

func adminReq(t *testing.T, s *httptest.Server, method, path, body string) (int, string) {
	t.Helper()
	req, err := http.NewRequest(method, s.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer sekrit")
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

func TestContactMutations(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"stuck@example.com"}`)

	// Manual confirm: pending → confirmed, pending tokens cleaned up.
	code, body := adminReq(t, s, "POST", "/admin/contacts/confirm", `{"list_key":"pk_nl","email":"stuck@example.com"}`)
	if code != 200 || !strings.Contains(body, `"confirmed"`) {
		t.Fatalf("confirm = %d %s", code, body)
	}
	if got := contactStatus(t, d, "pk_nl", "stuck@example.com"); got != "confirmed" {
		t.Fatalf("status after manual confirm = %q", got)
	}
	var tokens int
	_ = d.QueryRow(`SELECT COUNT(*) FROM tokens WHERE email='stuck@example.com'`).Scan(&tokens)
	if tokens != 0 {
		t.Fatalf("manual confirm left %d tokens", tokens)
	}

	// Confirm is 404 for a contact that does not exist.
	code, _ = adminReq(t, s, "POST", "/admin/contacts/confirm", `{"list_key":"pk_nl","email":"ghost@example.com"}`)
	if code != 404 {
		t.Fatalf("confirm unknown = %d, want 404", code)
	}

	// Resend: pending contact gets a fresh token; confirmed contact is rejected.
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"waiting@example.com"}`)
	code, body = adminReq(t, s, "POST", "/admin/contacts/resend", `{"list_key":"pk_nl","email":"waiting@example.com"}`)
	if code != 200 || !strings.Contains(body, `"sent"`) {
		t.Fatalf("resend = %d %s", code, body)
	}
	_ = d.QueryRow(`SELECT COUNT(*) FROM tokens WHERE email='waiting@example.com'`).Scan(&tokens)
	if tokens != 2 { // original subscribe + resend
		t.Fatalf("resend tokens = %d, want 2", tokens)
	}
	code, _ = adminReq(t, s, "POST", "/admin/contacts/resend", `{"list_key":"pk_nl","email":"stuck@example.com"}`)
	if code != 400 {
		t.Fatalf("resend confirmed = %d, want 400", code)
	}

	// Delete: contact and tokens gone.
	code, body = adminReq(t, s, "DELETE", "/admin/contacts?list_key=pk_nl&email=waiting@example.com", "")
	if code != 200 || !strings.Contains(body, `"deleted"`) {
		t.Fatalf("delete = %d %s", code, body)
	}
	var n int
	_ = d.QueryRow(`SELECT COUNT(*) FROM contacts WHERE email='waiting@example.com'`).Scan(&n)
	if n != 0 {
		t.Fatal("delete left the contact behind")
	}
	_ = d.QueryRow(`SELECT COUNT(*) FROM tokens WHERE email='waiting@example.com'`).Scan(&tokens)
	if tokens != 0 {
		t.Fatal("delete left tokens behind")
	}

	// Mutations require the key.
	req, _ := http.NewRequest("DELETE", s.URL+"/admin/contacts?list_key=pk_nl&email=x@y.co", nil)
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatalf("unauth delete: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != 401 {
		t.Fatalf("unauth delete = %d, want 401", resp.StatusCode)
	}
}

// Metadata collected at subscribe time must come back out.
func TestMetadataRoundtrip(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	meta := `{"source":"/pricing","plan":"pro"}`
	code, body := postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"meta@x.co","metadata":`+strconv.Quote(meta)+`}`)
	if code != 200 {
		t.Fatalf("subscribe = %d %s", code, body)
	}

	code2, respBody := adminReq(t, s, "GET", "/admin/contacts?list_key=pk_nl", "")
	if code2 != 200 {
		t.Fatalf("contacts = %d %s", code2, respBody)
	}
	var out struct {
		Contacts []struct {
			Email    string `json:"email"`
			Metadata string `json:"metadata"`
		} `json:"contacts"`
	}
	if err := json.Unmarshal([]byte(respBody), &out); err != nil {
		t.Fatalf("decode contacts: %v", err)
	}
	if len(out.Contacts) != 1 || out.Contacts[0].Metadata != meta {
		t.Fatalf("metadata roundtrip = %+v, want %q", out.Contacts, meta)
	}
}

func TestExportCSVQuotesFields(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	// Metadata with a comma, a quote, and a newline must not break columns.
	tricky := `{"a":"x,y","b":"say \"hi\""}`
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"tricky@x.co","metadata":`+strconv.Quote(tricky)+`}`)

	code, body := adminReq(t, s, "GET", "/admin/export?list_key=pk_nl", "")
	if code != 200 {
		t.Fatalf("export = %d", code)
	}
	lines := strings.Split(strings.TrimRight(body, "\n"), "\n")
	if len(lines) != 2 {
		t.Fatalf("export rows = %d, want 2 (header + 1 contact)", len(lines))
	}
	row := lines[1]
	// The honest check: a real CSV parser must see exactly 5 fields.
	fields, err := csv.NewReader(strings.NewReader(row)).Read()
	if err != nil {
		t.Fatalf("row is not parseable CSV: %v — %s", err, row)
	}
	if len(fields) != 5 {
		t.Fatalf("row parses into %d fields, want 5: %q", len(fields), fields)
	}
	if fields[0] != "tricky@x.co" || fields[2] != tricky {
		t.Fatalf("roundtrip mismatch: %q", fields)
	}
}

func TestPurgeExpiredTokens(t *testing.T) {
	_, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")

	ins := func(token, when string) {
		t.Helper()
		if _, err := d.Exec(`INSERT INTO tokens(token, list_id, email, expires_at) VALUES(?, 'pk_nl', 'x@y.co', ?)`, token, when); err != nil {
			t.Fatalf("insert token: %v", err)
		}
	}
	ins("fresh", time.Now().Add(time.Hour).UTC().Format("2006-01-02 15:04:05"))
	ins("stale", time.Now().Add(-time.Hour).UTC().Format("2006-01-02 15:04:05"))

	db.PurgeExpiredTokens(d)

	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM tokens`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("tokens after purge = %d, want 1 (fresh only)", n)
	}
	var token string
	if err := d.QueryRow(`SELECT token FROM tokens`).Scan(&token); err != nil || token != "fresh" {
		t.Fatalf("purge kept the wrong token: %q", token)
	}
}

// Ten bad keys from one IP lock out /admin/* for the window — even the
// correct key is refused, so an attacker can't keep guessing.
func TestAdminBruteForceLockout(t *testing.T) {
	s, _ := testServer(t)

	for i := 0; i < adminFailLimit; i++ {
		req, _ := http.NewRequest("GET", s.URL+"/admin/lists", nil)
		req.Header.Set("Authorization", "Bearer wrong-key-"+string(rune('a'+i)))
		resp, err := s.Client().Do(req)
		if err != nil {
			t.Fatalf("attempt %d: %v", i, err)
		}
		resp.Body.Close()
		if resp.StatusCode != 401 {
			t.Fatalf("attempt %d = %d, want 401", i, resp.StatusCode)
		}
	}
	code, _ := adminReq(t, s, "GET", "/admin/lists", "")
	if code != 429 {
		t.Fatalf("correct key after lockout = %d, want 429", code)
	}
}

func TestListCountsIncludeUnsubscribed(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")

	// two signups; confirm one, unsubscribe the other
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"keep@x.co"}`)
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"gone@x.co"}`)
	var token string
	if err := d.QueryRow(`SELECT token FROM tokens WHERE email='keep@x.co'`).Scan(&token); err != nil {
		t.Fatal(err)
	}
	resp, err := s.Client().Get(s.URL + "/v1/confirm?token=" + token)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	code, _ := postJSON(t, s, "/v1/unsubscribe", `{"list_key":"pk_nl","email":"gone@x.co"}`)
	if code != 200 {
		t.Fatalf("unsubscribe = %d", code)
	}

	code, body := adminReq(t, s, "GET", "/admin/lists", "")
	if code != 200 {
		t.Fatalf("lists = %d", code)
	}
	var lists []struct {
		Confirmed    int `json:"confirmed"`
		Pending      int `json:"pending"`
		Unsubscribed int `json:"unsubscribed"`
	}
	if err := json.Unmarshal([]byte(body), &lists); err != nil || len(lists) != 1 {
		t.Fatalf("lists decode: %v %s", err, body)
	}
	got := lists[0]
	if got.Confirmed != 1 || got.Pending != 0 || got.Unsubscribed != 1 {
		t.Fatalf("counts = confirmed:%d pending:%d unsubscribed:%d, want 1/0/1", got.Confirmed, got.Pending, got.Unsubscribed)
	}
}

func TestConfirmRedirect(t *testing.T) {
	s, d := testServer(t)
	if _, err := d.Exec(`INSERT INTO lists(id, name, type, sender_name, sender_email, provider, confirm_redirect)
		VALUES('pk_red', 'Red List', 'newsletter', 'T', 't@x.co', 'smtp', 'https://example.com/thanks')`); err != nil {
		t.Fatal(err)
	}
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_red","email":"r@x.co"}`)
	var token string
	if err := d.QueryRow(`SELECT token FROM tokens WHERE email='r@x.co'`).Scan(&token); err != nil {
		t.Fatal(err)
	}

	// The test client follows redirects; disable that to observe the 302.
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := client.Get(s.URL + "/v1/confirm?token=" + token)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 302 || resp.Header.Get("Location") != "https://example.com/thanks" {
		t.Fatalf("confirm redirect = %d %q", resp.StatusCode, resp.Header.Get("Location"))
	}
}

func TestConfirmExpiredToken(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	if _, err := d.Exec(`INSERT INTO tokens(token, list_id, email, expires_at)
		VALUES('deadbeef', 'pk_nl', 'old@x.co', datetime('now', '-1 day'))`); err != nil {
		t.Fatal(err)
	}
	resp, err := s.Client().Get(s.URL + "/v1/confirm?token=deadbeef")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 400 {
		t.Fatalf("expired token = %d, want 400", resp.StatusCode)
	}
}

func TestResubscribeConfirmedIsNoop(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"happy@x.co"}`)
	adminReq(t, s, "POST", "/admin/contacts/confirm", `{"list_key":"pk_nl","email":"happy@x.co"}`)

	code, body := postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"happy@x.co"}`)
	if code != 200 || !strings.Contains(body, "already subscribed") {
		t.Fatalf("resubscribe = %d %s", code, body)
	}
	var tokens int
	_ = d.QueryRow(`SELECT COUNT(*) FROM tokens WHERE email='happy@x.co'`).Scan(&tokens)
	if tokens != 0 {
		t.Fatalf("resubscribe of confirmed contact minted %d tokens", tokens)
	}
}

func TestListCRUD(t *testing.T) {
	s, d := testServer(t)

	code, body := adminReq(t, s, "POST", "/admin/lists",
		`{"name":"CRUD List","type":"waitlist","sender_name":"T","sender_email":"t@x.co","provider":"plunk","welcome_subject":"Hi","welcome_body":"<p>hi</p>","confirm_redirect":"https://x.co/t"}`)
	if code != 201 || !strings.Contains(body, `"list_key":"pk_`) {
		t.Fatalf("create = %d %s", code, body)
	}
	var created struct {
		ListKey string `json:"list_key"`
	}
	if err := json.Unmarshal([]byte(body), &created); err != nil {
		t.Fatal(err)
	}

	code, body = adminReq(t, s, "PATCH", "/admin/lists?list_key="+created.ListKey, `{"name":"Renamed","type":"newsletter","sender_name":"T","sender_email":"t2@x.co","provider":"smtp"}`)
	if code != 200 {
		t.Fatalf("update = %d %s", code, body)
	}
	var name, listType, sender string
	if err := d.QueryRow(`SELECT name, type, sender_email FROM lists WHERE id=?`, created.ListKey).Scan(&name, &listType, &sender); err != nil {
		t.Fatal(err)
	}
	if name != "Renamed" || listType != "newsletter" || sender != "t2@x.co" {
		t.Fatalf("update persisted wrong values: %q %q %q", name, listType, sender)
	}

	code, _ = adminReq(t, s, "DELETE", "/admin/lists?list_key="+created.ListKey, "")
	if code != 200 {
		t.Fatalf("delete = %d", code)
	}
	var n int
	_ = d.QueryRow(`SELECT COUNT(*) FROM lists`).Scan(&n)
	if n != 0 {
		t.Fatalf("delete left %d lists", n)
	}
	code, _ = adminReq(t, s, "DELETE", "/admin/lists?list_key="+created.ListKey, "")
	if code != 404 {
		t.Fatalf("re-delete = %d, want 404", code)
	}
}

func TestStats(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"s@x.co"}`)

	code, body := adminReq(t, s, "GET", "/admin/stats", "")
	if code != 200 {
		t.Fatalf("stats = %d", code)
	}
	var stats struct {
		Lists     int `json:"lists"`
		Confirmed int `json:"confirmed"`
		Pending   int `json:"pending"`
		ByDay     []struct {
			Day   string `json:"day"`
			Count int    `json:"count"`
		} `json:"by_day"`
	}
	if err := json.Unmarshal([]byte(body), &stats); err != nil {
		t.Fatalf("decode stats: %v", err)
	}
	if stats.Lists != 1 || stats.Pending != 1 || stats.Confirmed != 0 {
		t.Fatalf("stats = %+v", stats)
	}
	if stats.ByDay == nil {
		t.Fatal("by_day must serialize as [] not null")
	}
}

// Deploy verification: build identity must be readable without an admin key,
// and /health must name the same build so uptime checks can spot a stale deploy.
func TestVersionEndpointIsPublic(t *testing.T) {
	s, _ := testServer(t)

	resp, err := s.Client().Get(s.URL + "/version")
	if err != nil {
		t.Fatalf("GET /version: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("GET /version = %d", resp.StatusCode)
	}
	// The dashboard reads this cross-origin in production.
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want *", got)
	}
	var info struct {
		Version   string `json:"version"`
		Commit    string `json:"commit"`
		BuildTime string `json:"build_time"`
		Go        string `json:"go"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		t.Fatalf("decode /version: %v", err)
	}
	if info.Version == "" || info.Commit == "" || info.BuildTime == "" || info.Go == "" {
		t.Fatalf("incomplete build info: %+v", info)
	}

	hresp, err := s.Client().Get(s.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health: %v", err)
	}
	defer hresp.Body.Close()
	var health struct {
		Status  string `json:"status"`
		Version string `json:"version"`
		Commit  string `json:"commit"`
	}
	if err := json.NewDecoder(hresp.Body).Decode(&health); err != nil {
		t.Fatalf("decode /health: %v", err)
	}
	if health.Status != "ok" || health.Version != info.Version || health.Commit != info.Commit {
		t.Fatalf("/health = %+v, /version = %+v", health, info)
	}
}

func TestPublicCORSPreflight(t *testing.T) {
	s, _ := testServer(t)
	req, _ := http.NewRequest("OPTIONS", s.URL+"/v1/subscribe", nil)
	req.Header.Set("Origin", "https://anywhere.example")
	req.Header.Set("Access-Control-Request-Method", "POST")
	resp, err := s.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 204 || resp.Header.Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("preflight = %d allow-origin=%q", resp.StatusCode, resp.Header.Get("Access-Control-Allow-Origin"))
	}
}

// ---- redesign API additions ----

const tsFmt = "2006-01-02 15:04:05"

// seedContact inserts a contact with explicit timestamps (SQLite format, UTC).
// Empty confirmedAt / unsubAt store NULL.
func seedContact(t *testing.T, d *sql.DB, listID, email, status string, created time.Time, confirmedAt, unsubAt string) {
	t.Helper()
	var c, u any
	if confirmedAt != "" {
		c = confirmedAt
	}
	if unsubAt != "" {
		u = unsubAt
	}
	if _, err := d.Exec(`INSERT INTO contacts(list_id, email, status, confirmed_at, unsubscribed_at, created_at)
		VALUES(?, ?, ?, ?, ?, ?)`, listID, email, status, c, u, created.UTC().Format(tsFmt)); err != nil {
		t.Fatalf("seed %s: %v", email, err)
	}
}

func getJSON(t *testing.T, s *httptest.Server, path string, v any) {
	t.Helper()
	code, body := adminReq(t, s, "GET", path, "")
	if code != 200 {
		t.Fatalf("GET %s = %d %s", path, code, body)
	}
	if err := json.Unmarshal([]byte(body), v); err != nil {
		t.Fatalf("decode %s: %v (%s)", path, err, body)
	}
}

func TestEnsureSchemaIdempotentAndColumn(t *testing.T) {
	d, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	d.SetMaxOpenConns(1)
	// Simulate a pre-migration database: contacts without unsubscribed_at.
	if _, err := d.Exec(`CREATE TABLE contacts (
		id INTEGER PRIMARY KEY AUTOINCREMENT, list_id TEXT NOT NULL, email TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending', position INTEGER NOT NULL DEFAULT 0,
		metadata TEXT NOT NULL DEFAULT '{}', confirmed_at DATETIME,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(list_id, email))`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := db.EnsureSchema(d); err != nil {
			t.Fatalf("EnsureSchema run %d: %v", i+1, err)
		}
	}
	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('contacts') WHERE name='unsubscribed_at'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("unsubscribed_at column count = %d, err %v", n, err)
	}
}

func TestUnsubscribeSetsTimestampAndResubscribeClears(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_nl", "newsletter")
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"u@x.co"}`)

	unsubAt := func() sql.NullString {
		var v sql.NullString
		if err := d.QueryRow(`SELECT unsubscribed_at FROM contacts WHERE email='u@x.co'`).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}
	if unsubAt().Valid {
		t.Fatal("unsubscribed_at should start NULL")
	}
	postJSON(t, s, "/v1/unsubscribe", `{"list_key":"pk_nl","email":"u@x.co"}`)
	if !unsubAt().Valid {
		t.Fatal("POST unsubscribe did not set unsubscribed_at")
	}
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_nl","email":"u@x.co"}`)
	if unsubAt().Valid {
		t.Fatal("re-subscribe must clear unsubscribed_at")
	}
	resp, err := s.Client().Get(s.URL + "/v1/unsubscribe?list_key=pk_nl&email=u@x.co")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if !unsubAt().Valid {
		t.Fatal("GET unsubscribe did not set unsubscribed_at")
	}
}

func TestAdminListsNewFields(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	createList(t, d, "pk_b", "newsletter")
	now := time.Now()
	seedContact(t, d, "pk_a", "old@x.co", "pending", now.Add(-72*time.Hour), "", "")
	seedContact(t, d, "pk_a", "new@x.co", "pending", now.Add(-1*time.Hour), "", "")
	seedContact(t, d, "pk_a", "oldc@x.co", "confirmed", now.Add(-72*time.Hour), now.Format(tsFmt), "")

	var lists []struct {
		Key          string `json:"list_key"`
		CreatedAt    string `json:"created_at"`
		StalePending int    `json:"stale_pending"`
		Pending      int    `json:"pending"`
	}
	getJSON(t, s, "/admin/lists", &lists)
	if len(lists) != 2 {
		t.Fatalf("lists = %+v", lists)
	}
	for _, l := range lists {
		if l.CreatedAt == "" {
			t.Fatalf("created_at missing: %+v", l)
		}
		want := 0
		if l.Key == "pk_a" {
			want = 1
		}
		if l.StalePending != want {
			t.Fatalf("%s stale_pending = %d, want %d", l.Key, l.StalePending, want)
		}
		if l.Key == "pk_a" && l.Pending != 2 {
			t.Fatalf("pending = %d, want 2", l.Pending)
		}
	}
}

func TestContactsAcrossListsAndPendingOlderThan(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	if _, err := d.Exec(`INSERT INTO lists(id, name, type, sender_name, sender_email, provider)
		VALUES('pk_b', 'Second', 'newsletter', 'T', 'h@t.dev', 'smtp')`); err != nil {
		t.Fatal(err)
	}
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_a","email":"a@x.co"}`)
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_b","email":"b@x.co"}`)
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_b","email":"c@x.co"}`)
	// Backdate b@ to 3 days ago, c@ to 10 hours ago; a@ stays fresh.
	d.Exec(`UPDATE contacts SET created_at = datetime('now', '-72 hours') WHERE email='b@x.co'`)
	d.Exec(`UPDATE contacts SET created_at = datetime('now', '-10 hours') WHERE email='c@x.co'`)

	type row struct {
		Email          string  `json:"email"`
		ListKey        string  `json:"list_key"`
		ListName       string  `json:"list_name"`
		UnsubscribedAt *string `json:"unsubscribed_at"`
	}
	var res struct {
		Total    int   `json:"total"`
		Contacts []row `json:"contacts"`
	}
	getJSON(t, s, "/admin/contacts", &res)
	if res.Total != 3 || len(res.Contacts) != 3 {
		t.Fatalf("cross-list = %+v", res)
	}
	if res.Contacts[0].Email != "c@x.co" { // id DESC
		t.Fatalf("order = %+v", res.Contacts)
	}
	for _, c := range res.Contacts {
		if c.ListKey == "" || c.ListName == "" {
			t.Fatalf("row lacks list info: %+v", c)
		}
		if c.ListKey == "pk_b" && c.ListName != "Second" {
			t.Fatalf("list_name = %q", c.ListName)
		}
	}
	// Existing list_key filter still works.
	getJSON(t, s, "/admin/contacts?list_key=pk_a", &res)
	if res.Total != 1 || res.Contacts[0].Email != "a@x.co" {
		t.Fatalf("list_key filter = %+v", res)
	}
	getJSON(t, s, "/admin/contacts?pending_older_than=48", &res)
	if res.Total != 1 || res.Contacts[0].Email != "b@x.co" {
		t.Fatalf("older than 48h = %+v", res)
	}
	getJSON(t, s, "/admin/contacts?pending_older_than=5", &res)
	if res.Total != 2 {
		t.Fatalf("older than 5h = %+v", res)
	}
	getJSON(t, s, "/admin/contacts?pending_older_than=5&list_key=pk_a", &res)
	if res.Total != 0 {
		t.Fatalf("older than 5h in pk_a = %+v", res)
	}
	// Non-pending contacts are excluded even when old.
	d.Exec(`UPDATE contacts SET status='confirmed' WHERE email='b@x.co'`)
	getJSON(t, s, "/admin/contacts?pending_older_than=48", &res)
	if res.Total != 0 {
		t.Fatalf("confirmed must not match pending_older_than: %+v", res)
	}
	if code, _ := adminReq(t, s, "GET", "/admin/contacts?pending_older_than=0", ""); code != 400 {
		t.Fatalf("pending_older_than=0 = %d, want 400", code)
	}
	if code, _ := adminReq(t, s, "GET", "/admin/contacts?pending_older_than=abc", ""); code != 400 {
		t.Fatalf("pending_older_than=abc = %d, want 400", code)
	}
}

type statsResp struct {
	Unsubscribed int `json:"unsubscribed"`
	StalePending int `json:"stale_pending"`
	Days         int `json:"days"`
	Series       []struct {
		Day          string `json:"day"`
		Confirmed    int    `json:"confirmed"`
		Pending      int    `json:"pending"`
		Unsubscribed int    `json:"unsubscribed"`
	} `json:"series"`
	Period struct {
		Signups, Confirmed, Unsubscribed int
	} `json:"period"`
	PrevPeriod struct {
		Signups, Confirmed, Unsubscribed int
	} `json:"prev_period"`
	ListSeries map[string][]int `json:"list_series"`
}

func TestStatsDaysClamping(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	for q, want := range map[string]int{
		"": 14, "?days=7": 7, "?days=30": 30, "?days=90": 90, "?days=14": 14,
		"?days=1": 7, "?days=0": 7, "?days=-5": 7, "?days=10": 7, "?days=20": 14, "?days=25": 30,
		"?days=60": 30, "?days=61": 90, "?days=1000": 90, "?days=abc": 14,
	} {
		var st statsResp
		getJSON(t, s, "/admin/stats"+q, &st)
		if st.Days != want || len(st.Series) != want {
			t.Fatalf("stats%s: days=%d series=%d, want %d", q, st.Days, len(st.Series), want)
		}
	}
}

func TestStatsSeriesPeriodsAndListSeries(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	createList(t, d, "pk_b", "newsletter")
	createList(t, d, "pk_empty", "newsletter")
	now := time.Now().UTC()
	day := func(n int) time.Time { return now.AddDate(0, 0, -n) }
	ts := func(tm time.Time) string { return tm.Format(tsFmt) }

	// Current 7-day window: today (0), 2 days ago, 6 days ago (first day).
	seedContact(t, d, "pk_a", "c0@x.co", "confirmed", day(0), ts(day(0)), "")
	seedContact(t, d, "pk_a", "p0@x.co", "pending", day(0), "", "")
	seedContact(t, d, "pk_b", "c2@x.co", "confirmed", day(2), ts(day(2)), "")
	seedContact(t, d, "pk_a", "u6@x.co", "unsubscribed", day(6), "", ts(day(1)))
	// Previous window (days 7..13).
	seedContact(t, d, "pk_a", "prevc@x.co", "confirmed", day(8), ts(day(8)), "")
	seedContact(t, d, "pk_a", "prevu@x.co", "unsubscribed", day(10), "", "")
	seedContact(t, d, "pk_a", "prevp@x.co", "pending", day(13), "", "")
	// Outside both windows.
	seedContact(t, d, "pk_a", "ancient@x.co", "confirmed", day(40), ts(day(40)), "")

	var st statsResp
	getJSON(t, s, "/admin/stats?days=7", &st)
	if st.Days != 7 || len(st.Series) != 7 {
		t.Fatalf("days/series = %d/%d", st.Days, len(st.Series))
	}
	// Oldest first, today last, consecutive days.
	if st.Series[6].Day != now.Format("2006-01-02") || st.Series[0].Day != day(6).Format("2006-01-02") {
		t.Fatalf("series days = %s .. %s", st.Series[0].Day, st.Series[6].Day)
	}
	if got := st.Series[6]; got.Confirmed != 1 || got.Pending != 1 || got.Unsubscribed != 0 {
		t.Fatalf("today = %+v", got)
	}
	if got := st.Series[4]; got.Confirmed != 1 { // day(2)
		t.Fatalf("day-2 = %+v", got)
	}
	if got := st.Series[0]; got.Unsubscribed != 1 { // day(6)
		t.Fatalf("day-6 = %+v", got)
	}
	if st.Series[1].Confirmed+st.Series[1].Pending+st.Series[1].Unsubscribed != 0 {
		t.Fatalf("zero day not zero-filled: %+v", st.Series[1])
	}
	if p := st.Period; p.Signups != 4 || p.Confirmed != 2 || p.Unsubscribed != 1 {
		t.Fatalf("period = %+v", p)
	}
	if p := st.PrevPeriod; p.Signups != 3 || p.Confirmed != 1 || p.Unsubscribed != 1 {
		t.Fatalf("prev_period = %+v", p)
	}
	if st.Unsubscribed != 2 {
		t.Fatalf("unsubscribed total = %d", st.Unsubscribed)
	}
	if len(st.ListSeries) != 3 {
		t.Fatalf("list_series must include every list: %v", st.ListSeries)
	}
	a, b, e := st.ListSeries["pk_a"], st.ListSeries["pk_b"], st.ListSeries["pk_empty"]
	if len(a) != 7 || len(b) != 7 || len(e) != 7 {
		t.Fatalf("list_series lengths: %v", st.ListSeries)
	}
	if a[6] != 1 || b[4] != 1 || a[4] != 0 {
		t.Fatalf("list_series values: a=%v b=%v", a, b)
	}
	for _, v := range e {
		if v != 0 {
			t.Fatalf("empty list series = %v", e)
		}
	}
}

func TestStatsStalePending(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	now := time.Now()
	seedContact(t, d, "pk_a", "stale@x.co", "pending", now.Add(-49*time.Hour), "", "")
	seedContact(t, d, "pk_a", "fresh@x.co", "pending", now.Add(-47*time.Hour), "", "")
	seedContact(t, d, "pk_a", "conf@x.co", "confirmed", now.Add(-100*time.Hour), now.Format(tsFmt), "")
	var st statsResp
	getJSON(t, s, "/admin/stats", &st)
	if st.StalePending != 1 {
		t.Fatalf("stale_pending = %d, want 1", st.StalePending)
	}
}

func TestActivity(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	createList(t, d, "pk_b", "newsletter")
	// a@: signup 10:00, confirmed 11:00. b@: signup 12:00, unsubscribed 13:00.
	// old@: unsubscribed with no timestamp (legacy) -> only a signup event.
	mk := func(list, email, status, created, conf, unsub string) {
		var c, u any
		if conf != "" {
			c = conf
		}
		if unsub != "" {
			u = unsub
		}
		if _, err := d.Exec(`INSERT INTO contacts(list_id, email, status, confirmed_at, unsubscribed_at, created_at)
			VALUES(?,?,?,?,?,?)`, list, email, status, c, u, created); err != nil {
			t.Fatal(err)
		}
	}
	mk("pk_a", "a@x.co", "confirmed", "2026-01-01 10:00:00", "2026-01-01 11:00:00", "")
	mk("pk_b", "b@x.co", "unsubscribed", "2026-01-01 12:00:00", "", "2026-01-01 13:00:00")
	mk("pk_b", "old@x.co", "unsubscribed", "2026-01-01 09:00:00", "", "")

	type ev struct {
		Type, Email string
		ListKey     string `json:"list_key"`
		ListName    string `json:"list_name"`
		At          string
	}
	var res struct {
		Events []ev `json:"events"`
	}
	getJSON(t, s, "/admin/activity", &res)
	want := []string{"unsubscribed:b@x.co", "signup:b@x.co", "confirmed:a@x.co", "signup:a@x.co", "signup:old@x.co"}
	if len(res.Events) != len(want) {
		t.Fatalf("events = %+v", res.Events)
	}
	for i, e := range res.Events {
		if e.Type+":"+e.Email != want[i] {
			t.Fatalf("event %d = %s:%s, want %s", i, e.Type, e.Email, want[i])
		}
		if e.ListKey == "" || e.ListName != "Test List" || e.At == "" {
			t.Fatalf("event fields: %+v", e)
		}
	}
	// Cursor: strictly older than the 12:00 signup.
	getJSON(t, s, "/admin/activity?before="+url.QueryEscape("2026-01-01 12:00:00"), &res)
	if len(res.Events) != 3 || res.Events[0].Type != "confirmed" {
		t.Fatalf("before cursor = %+v", res.Events)
	}
	// Limit.
	getJSON(t, s, "/admin/activity?limit=2", &res)
	if len(res.Events) != 2 {
		t.Fatalf("limit=2 -> %d events", len(res.Events))
	}
	getJSON(t, s, "/admin/activity?limit=0", &res)
	if len(res.Events) != 1 {
		t.Fatalf("limit=0 clamps to 1, got %d", len(res.Events))
	}
	// list_key filter.
	getJSON(t, s, "/admin/activity?list_key=pk_a", &res)
	if len(res.Events) != 2 {
		t.Fatalf("list filter = %+v", res.Events)
	}
	for _, e := range res.Events {
		if e.ListKey != "pk_a" {
			t.Fatalf("leaked event %+v", e)
		}
	}
	getJSON(t, s, "/admin/activity?list_key=nope", &res)
	if res.Events == nil || len(res.Events) != 0 {
		t.Fatalf("unknown list must give [] not null: %+v", res.Events)
	}
	if code, _ := adminReq(t, s, "POST", "/admin/activity", ""); code != 405 {
		t.Fatalf("POST activity = %d", code)
	}
}

func TestActivityCursorPagination(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	_, err := d.Exec(`INSERT INTO contacts(list_id, email, status, confirmed_at, created_at) VALUES
		('pk_a', 'a@x.co', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
		('pk_a', 'b@x.co', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
		('pk_a', 'c@x.co', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
		('pk_a', 'd@x.co', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
		('pk_a', 'e@x.co', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
		('pk_a', 'f@x.co', 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
	if err != nil {
		t.Fatal(err)
	}

	type ev struct {
		Type, Email, At string
	}
	type page struct {
		Events     []ev   `json:"events"`
		NextCursor string `json:"next_cursor"`
	}
	seen := map[string]int{}
	cursor := ""
	pages := 0
	for {
		path := "/admin/activity?limit=5"
		if cursor != "" {
			path += "&cursor=" + url.QueryEscape(cursor)
		}
		var res page
		getJSON(t, s, path, &res)
		pages++
		for _, e := range res.Events {
			seen[e.Type+":"+e.Email]++
		}
		if res.NextCursor == "" {
			break
		}
		if pages > 10 {
			t.Fatal("activity cursor did not reach the end")
		}
		cursor = res.NextCursor
	}
	if pages != 3 || len(seen) != 12 {
		t.Fatalf("pages=%d unique events=%d, want 3 and 12", pages, len(seen))
	}
	for key, n := range seen {
		if n != 1 {
			t.Fatalf("%s appeared %d times", key, n)
		}
	}
	if code, _ := adminReq(t, s, "GET", "/admin/activity?cursor=broken", ""); code != 400 {
		t.Fatalf("invalid cursor = %d, want 400", code)
	}
}

func TestBulkContacts(t *testing.T) {
	s, d := testServer(t)
	createList(t, d, "pk_a", "newsletter")
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_a","email":"one@x.co"}`)
	postJSON(t, s, "/v1/subscribe", `{"list_key":"pk_a","email":"two@x.co"}`)

	type fail struct {
		ListKey string `json:"list_key"`
		Email   string `json:"email"`
		Error   string `json:"error"`
	}
	type result struct {
		Ok     int    `json:"ok"`
		Failed []fail `json:"failed"`
	}
	bulk := func(body string) (int, result) {
		code, out := adminReq(t, s, "POST", "/admin/contacts/bulk", body)
		var r result
		if code == 200 {
			if err := json.Unmarshal([]byte(out), &r); err != nil {
				t.Fatalf("decode %s: %v", out, err)
			}
		}
		return code, r
	}

	// Confirm: emails are trimmed/lower-cased; unknown contact is a partial failure.
	code, r := bulk(`{"action":"confirm","contacts":[
		{"list_key":"pk_a","email":"  ONE@x.co "},{"list_key":"pk_a","email":"ghost@x.co"},{"list_key":"","email":"x@x.co"}]}`)
	if code != 200 || r.Ok != 1 || len(r.Failed) != 2 {
		t.Fatalf("confirm = %d %+v", code, r)
	}
	if r.Failed[0].Email != "ghost@x.co" || r.Failed[0].Error != "unknown contact" {
		t.Fatalf("failure = %+v", r.Failed[0])
	}
	if contactStatus(t, d, "pk_a", "one@x.co") != "confirmed" {
		t.Fatal("one@ not confirmed")
	}

	// Reconfirming through either endpoint is a no-op and preserves history.
	const originalConfirmation = "2026-01-02 03:04:05"
	if _, err := d.Exec(`UPDATE contacts SET confirmed_at=? WHERE list_id='pk_a' AND email='one@x.co'`, originalConfirmation); err != nil {
		t.Fatal(err)
	}
	if code, _ := adminReq(t, s, "POST", "/admin/contacts/confirm", `{"list_key":"pk_a","email":"one@x.co"}`); code != 400 {
		t.Fatalf("single reconfirm = %d, want 400", code)
	}
	code, r = bulk(`{"action":"confirm","contacts":[{"list_key":"pk_a","email":"one@x.co"}]}`)
	if code != 200 || r.Ok != 0 || len(r.Failed) != 1 || r.Failed[0].Error != "already confirmed" {
		t.Fatalf("bulk reconfirm = %d %+v", code, r)
	}
	var confirmedAt string
	if err := d.QueryRow(`SELECT confirmed_at FROM contacts WHERE list_id='pk_a' AND email='one@x.co'`).Scan(&confirmedAt); err != nil {
		t.Fatal(err)
	}
	parsedConfirmation, err := time.Parse(time.RFC3339, confirmedAt)
	if err != nil {
		parsedConfirmation, err = time.Parse(tsFmt, confirmedAt)
	}
	if err != nil || parsedConfirmation.UTC().Format(tsFmt) != originalConfirmation {
		t.Fatalf("confirmed_at changed to %q", confirmedAt)
	}

	// Resend: confirmed is skipped and reported; pending gets a fresh token.
	var before int
	d.QueryRow(`SELECT COUNT(*) FROM tokens WHERE email='two@x.co'`).Scan(&before)
	code, r = bulk(`{"action":"resend","contacts":[{"list_key":"pk_a","email":"one@x.co"},{"list_key":"pk_a","email":"two@x.co"}]}`)
	if code != 200 || r.Ok != 1 || len(r.Failed) != 1 || r.Failed[0].Error != "already confirmed" || r.Failed[0].Email != "one@x.co" {
		t.Fatalf("resend = %d %+v", code, r)
	}
	var after int
	d.QueryRow(`SELECT COUNT(*) FROM tokens WHERE email='two@x.co'`).Scan(&after)
	if after != before+1 {
		t.Fatalf("tokens %d -> %d, want +1", before, after)
	}

	// Delete.
	code, r = bulk(`{"action":"delete","contacts":[{"list_key":"pk_a","email":"one@x.co"},{"list_key":"pk_a","email":"two@x.co"},{"list_key":"pk_a","email":"two@x.co"}]}`)
	if code != 200 || r.Ok != 2 || len(r.Failed) != 1 {
		t.Fatalf("delete = %d %+v", code, r)
	}
	var n int
	d.QueryRow(`SELECT COUNT(*) FROM contacts`).Scan(&n)
	if n != 0 {
		t.Fatalf("contacts left = %d", n)
	}
	d.QueryRow(`SELECT COUNT(*) FROM tokens`).Scan(&n)
	if n != 0 {
		t.Fatalf("tokens left = %d", n)
	}

	// Validation: bad action, empty list, over the 500 limit, bad json, wrong method.
	if code, _ := bulk(`{"action":"nuke","contacts":[{"list_key":"pk_a","email":"a@x.co"}]}`); code != 400 {
		t.Fatalf("bad action = %d", code)
	}
	if code, _ := bulk(`{"action":"delete","contacts":[]}`); code != 400 {
		t.Fatalf("empty = %d", code)
	}
	if code, _ := bulk(`not json`); code != 400 {
		t.Fatalf("bad json = %d", code)
	}
	item := `{"list_key":"pk_a","email":"z@x.co"}`
	mkBody := func(n int) string {
		return `{"action":"delete","contacts":[` + strings.TrimSuffix(strings.Repeat(item+",", n), ",") + `]}`
	}
	if code, _ := bulk(mkBody(501)); code != 400 {
		t.Fatalf("501 contacts = %d, want 400", code)
	}
	if code, r := bulk(mkBody(500)); code != 200 || len(r.Failed) != 500 {
		t.Fatalf("500 contacts = %d, %d failed", code, len(r.Failed))
	}
	if code, _ := adminReq(t, s, "GET", "/admin/contacts/bulk", ""); code != 405 {
		t.Fatalf("GET bulk = %d", code)
	}
	if code, _ := postJSON(t, s, "/admin/contacts/bulk", `{}`); code != 401 {
		t.Fatalf("unauthenticated bulk = %d", code)
	}
}
