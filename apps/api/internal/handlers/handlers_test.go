package handlers

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

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
