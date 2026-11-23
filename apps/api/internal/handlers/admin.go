package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"mailbag/internal/mailer"
	"mailbag/internal/version"
)

// Admin handles /admin/* (Bearer ADMIN_API_KEY).
type Admin struct {
	DB      *sql.DB
	Key     string
	Mailer  *mailer.Mailer
	BaseURL string

	origins []string

	// Failed-auth throttling: per-IP counters, lockout after too many bad
	// keys so ADMIN_API_KEY can't be brute-forced.
	mu    sync.Mutex
	fails map[string][]time.Time
}

const (
	adminFailLimit  = 10
	adminFailWindow = 15 * time.Minute
)

func NewAdmin(db *sql.DB, m *mailer.Mailer, baseURL, key, originsCSV string) *Admin {
	var origins []string
	for _, o := range strings.Split(originsCSV, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	return &Admin{DB: db, Key: key, Mailer: m, BaseURL: baseURL, origins: origins, fails: map[string][]time.Time{}}
}

func (a *Admin) pruneFails(ip string, now time.Time) []time.Time {
	cut := now.Add(-adminFailWindow)
	keep := a.fails[ip][:0]
	for _, t := range a.fails[ip] {
		if t.After(cut) {
			keep = append(keep, t)
		}
	}
	if len(keep) == 0 {
		delete(a.fails, ip)
		return nil
	}
	a.fails[ip] = keep
	return keep
}

func (a *Admin) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		a.mu.Lock()
		fails := a.pruneFails(ip, time.Now())
		a.mu.Unlock()
		if len(fails) >= adminFailLimit {
			writeJSON(w, 429, map[string]string{"error": "too many failed attempts, retry later"})
			return
		}
		// Constant-time: key length is public anyway (config), the
		// comparison itself must not leak how many bytes matched.
		if subtle.ConstantTimeCompare([]byte("Bearer "+a.Key), []byte(r.Header.Get("Authorization"))) != 1 {
			a.mu.Lock()
			a.fails[ip] = append(a.pruneFails(ip, time.Now()), time.Now())
			a.mu.Unlock()
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		a.mu.Lock()
		delete(a.fails, ip)
		a.mu.Unlock()
		next(w, r)
	}
}

// cors allows the configured dashboard origins to call /admin/* from a browser.
// Empty allowlist = same-origin / proxy only (no CORS headers emitted).
func (a *Admin) cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			for _, o := range a.origins {
				if o == "*" || o == origin {
					if o == "*" {
						w.Header().Set("Access-Control-Allow-Origin", "*")
					} else {
						w.Header().Set("Access-Control-Allow-Origin", origin)
					}
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
					break
				}
			}
		}
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next(w, r)
	}
}

func (a *Admin) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/lists", a.cors(a.auth(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			a.listLists(w, r)
		case "POST":
			a.createList(w, r)
		case "PATCH":
			a.updateList(w, r)
		case "DELETE":
			a.deleteList(w, r)
		default:
			writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		}
	})))
	mux.HandleFunc("/admin/contacts", a.cors(a.auth(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			a.listContacts(w, r)
		case "DELETE":
			a.deleteContact(w, r)
		default:
			writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		}
	})))
	mux.HandleFunc("/admin/contacts/confirm", a.cors(a.auth(a.confirmContact)))
	mux.HandleFunc("/admin/contacts/resend", a.cors(a.auth(a.resendContact)))
	mux.HandleFunc("/admin/contacts/bulk", a.cors(a.auth(a.bulkContacts)))
	mux.HandleFunc("/admin/stats", a.cors(a.auth(a.stats)))
	mux.HandleFunc("/admin/activity", a.cors(a.auth(a.activity)))
	mux.HandleFunc("/admin/export", a.cors(a.auth(a.exportCSV)))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "version": version.Version, "commit": version.Commit})
	})
	// Public build identity — lets a deploy be verified from the outside
	// (`curl $API/version`) without an admin key. CORS is open because the
	// dashboard reads it cross-origin in production; nothing here is sensitive.
	mux.HandleFunc("/version", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		writeJSON(w, 200, version.Get())
	})
}

type createListReq struct {
	Name            string `json:"name"`
	Type            string `json:"type"`
	SenderName      string `json:"sender_name"`
	SenderEmail     string `json:"sender_email"`
	Provider        string `json:"provider"`
	WelcomeSubject  string `json:"welcome_subject"`
	WelcomeBody     string `json:"welcome_body"`
	ConfirmRedirect string `json:"confirm_redirect"`
}

func normType(t string) string {
	if t == "waitlist" {
		return "waitlist"
	}
	return "newsletter"
}

func normProvider(p string) string {
	if p == "plunk" {
		return "plunk"
	}
	return "smtp"
}

func (a *Admin) createList(w http.ResponseWriter, r *http.Request) {
	var req createListReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	if req.Name == "" || req.SenderEmail == "" {
		writeJSON(w, 400, map[string]string{"error": "name and sender_email required"})
		return
	}
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	id := "pk_" + hex.EncodeToString(b)
	_, err := a.DB.Exec(`INSERT INTO lists(id, name, type, sender_name, sender_email, provider, welcome_subject, welcome_body, confirm_redirect)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, normType(req.Type), req.SenderName, req.SenderEmail, normProvider(req.Provider), req.WelcomeSubject, req.WelcomeBody, req.ConfirmRedirect)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, 201, map[string]string{"list_key": id, "name": req.Name})
}

type listRow struct {
	Key             string `json:"list_key"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	SenderName      string `json:"sender_name"`
	SenderEmail     string `json:"sender_email"`
	Provider        string `json:"provider"`
	WelcomeSubject  string `json:"welcome_subject"`
	WelcomeBody     string `json:"welcome_body"`
	ConfirmRedirect string `json:"confirm_redirect"`
	Confirmed       int    `json:"confirmed"`
	Pending         int    `json:"pending"`
	Unsubscribed    int    `json:"unsubscribed"`
	CreatedAt       string `json:"created_at"`
	StalePending    int    `json:"stale_pending"`
}

func (a *Admin) listLists(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`SELECT l.id, l.name, l.type, l.sender_name, l.sender_email, l.provider,
		l.welcome_subject, l.welcome_body, l.confirm_redirect,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='confirmed') AS confirmed,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='pending') AS pending,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='unsubscribed') AS unsubscribed,
		l.created_at,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='pending' AND c.created_at < datetime('now', '-48 hours')) AS stale_pending
		FROM lists l ORDER BY l.created_at DESC`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	var out []listRow
	for rows.Next() {
		var x listRow
		_ = rows.Scan(&x.Key, &x.Name, &x.Type, &x.SenderName, &x.SenderEmail, &x.Provider,
			&x.WelcomeSubject, &x.WelcomeBody, &x.ConfirmRedirect, &x.Confirmed, &x.Pending, &x.Unsubscribed, &x.CreatedAt, &x.StalePending)
		out = append(out, x)
	}
	if out == nil {
		out = []listRow{}
	}
	writeJSON(w, 200, out)
}

func (a *Admin) updateList(w http.ResponseWriter, r *http.Request) {
	listKey := r.URL.Query().Get("list_key")
	if listKey == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key required"})
		return
	}
	var req createListReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	res, err := a.DB.Exec(`UPDATE lists SET name=?, type=?, sender_name=?, sender_email=?, provider=?,
		welcome_subject=?, welcome_body=?, confirm_redirect=? WHERE id=?`,
		req.Name, normType(req.Type), req.SenderName, req.SenderEmail, normProvider(req.Provider),
		req.WelcomeSubject, req.WelcomeBody, req.ConfirmRedirect, listKey)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, 404, map[string]string{"error": "unknown list"})
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (a *Admin) deleteList(w http.ResponseWriter, r *http.Request) {
	listKey := r.URL.Query().Get("list_key")
	if listKey == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key required"})
		return
	}
	tx, err := a.DB.Begin()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer tx.Rollback()
	_, _ = tx.Exec(`DELETE FROM tokens WHERE list_id=?`, listKey)
	_, _ = tx.Exec(`DELETE FROM contacts WHERE list_id=?`, listKey)
	res, err := tx.Exec(`DELETE FROM lists WHERE id=?`, listKey)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSON(w, 404, map[string]string{"error": "unknown list"})
		return
	}
	_ = tx.Commit()
	writeJSON(w, 200, map[string]string{"status": "deleted"})
}

type contactRow struct {
	Email          string  `json:"email"`
	Status         string  `json:"status"`
	Position       int     `json:"position"`
	Metadata       string  `json:"metadata"`
	ConfirmedAt    *string `json:"confirmed_at"`
	CreatedAt      string  `json:"created_at"`
	ListKey        string  `json:"list_key"`
	ListName       string  `json:"list_name"`
	UnsubscribedAt *string `json:"unsubscribed_at"`
}

func nullStr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	s := n.String
	return &s
}

func (a *Admin) listContacts(w http.ResponseWriter, r *http.Request) {
	listKey := r.URL.Query().Get("list_key") // optional: empty = all lists
	status := r.URL.Query().Get("status")    // confirmed|pending|unsubscribed|""
	q := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("q")))
	limit := clampInt(queryInt(r, "limit", 50), 1, 500)
	offset := clampInt(queryInt(r, "offset", 0), 0, 1<<30)

	where := `1=1`
	var args []any
	if listKey != "" {
		where += ` AND c.list_id = ?`
		args = append(args, listKey)
	}
	if status == "confirmed" || status == "pending" || status == "unsubscribed" {
		where += ` AND c.status = ?`
		args = append(args, status)
	}
	if q != "" {
		where += ` AND lower(c.email) LIKE ?`
		args = append(args, "%"+q+"%")
	}
	if v := r.URL.Query().Get("pending_older_than"); v != "" {
		hours, err := strconv.Atoi(v)
		if err != nil || hours <= 0 {
			writeJSON(w, 400, map[string]string{"error": "pending_older_than must be a positive integer (hours)"})
			return
		}
		hours = clampInt(hours, 1, 24*3650)
		// Compare in SQLite's own timestamp format (created_at defaults to
		// CURRENT_TIMESTAMP); never against Go time values.
		where += ` AND c.status = 'pending' AND c.created_at < datetime('now', ?)`
		args = append(args, "-"+strconv.Itoa(hours)+" hours")
	}
	const from = ` FROM contacts c LEFT JOIN lists l ON l.id = c.list_id WHERE `
	var total int
	if err := a.DB.QueryRow(`SELECT COUNT(*)`+from+where, args...).Scan(&total); err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	args = append(args, limit, offset)
	rows, err := a.DB.Query(`SELECT c.email, c.status, c.position, c.metadata, c.confirmed_at, c.created_at,
		c.list_id, COALESCE(l.name, ''), c.unsubscribed_at`+from+where+` ORDER BY c.id DESC LIMIT ? OFFSET ?`, args...)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	var out []contactRow
	for rows.Next() {
		var c contactRow
		var confirmed, unsub sql.NullString
		_ = rows.Scan(&c.Email, &c.Status, &c.Position, &c.Metadata, &confirmed, &c.CreatedAt,
			&c.ListKey, &c.ListName, &unsub)
		c.ConfirmedAt = nullStr(confirmed)
		c.UnsubscribedAt = nullStr(unsub)
		out = append(out, c)
	}
	if out == nil {
		out = []contactRow{}
	}
	writeJSON(w, 200, map[string]any{"total": total, "contacts": out})
}

type contactReq struct {
	ListKey string `json:"list_key"`
	Email   string `json:"email"`
}

// apiError carries an HTTP status plus the JSON error message, so the core
// contact operations can be shared between the single and bulk endpoints.
type apiError struct {
	Code int
	Msg  string
}

func (e *apiError) Error() string { return e.Msg }

var errDB = &apiError{500, "db error"}

// writeErr writes err as a JSON error, using its status when it is an apiError.
func writeErr(w http.ResponseWriter, err error) {
	if ae, ok := err.(*apiError); ok {
		writeJSON(w, ae.Code, map[string]string{"error": ae.Msg})
		return
	}
	writeJSON(w, 500, map[string]string{"error": "db error"})
}

// deleteContactCore removes a contact (and its tokens). email must already be
// trimmed and lower-cased.
func (a *Admin) deleteContactCore(listKey, email string) error {
	tx, err := a.DB.Begin()
	if err != nil {
		return errDB
	}
	defer tx.Rollback()
	_, _ = tx.Exec(`DELETE FROM tokens WHERE list_id=? AND email=?`, listKey, email)
	res, err := tx.Exec(`DELETE FROM contacts WHERE list_id=? AND email=?`, listKey, email)
	if err != nil {
		return errDB
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return &apiError{404, "unknown contact"}
	}
	if err := tx.Commit(); err != nil {
		return errDB
	}
	return nil
}

// confirmContactCore marks a pending or unsubscribed contact confirmed without
// sending mail. Confirming twice must not rewrite the original confirmation.
func (a *Admin) confirmContactCore(listKey, email string) error {
	var status string
	if err := a.DB.QueryRow(`SELECT status FROM contacts WHERE list_id=? AND email=?`, listKey, email).Scan(&status); err != nil {
		if err == sql.ErrNoRows {
			return &apiError{404, "unknown contact"}
		}
		return errDB
	}
	if status == "confirmed" {
		return &apiError{400, "already confirmed"}
	}
	res, err := a.DB.Exec(`UPDATE contacts SET status='confirmed', confirmed_at=CURRENT_TIMESTAMP, unsubscribed_at=NULL
		WHERE list_id=? AND email=? AND status != 'confirmed'`, listKey, email)
	if err != nil {
		return errDB
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return &apiError{400, "already confirmed"}
	}
	_, _ = a.DB.Exec(`DELETE FROM tokens WHERE list_id=? AND email=?`, listKey, email)
	return nil
}

// resendContactCore issues a fresh confirm token and sends the email async.
func (a *Admin) resendContactCore(listKey, email string) error {
	var status string
	if err := a.DB.QueryRow(`SELECT status FROM contacts WHERE list_id=? AND email=?`, listKey, email).Scan(&status); err != nil {
		return &apiError{404, "unknown contact"}
	}
	if status == "confirmed" {
		return &apiError{400, "already confirmed"}
	}
	var listName, provider, senderName, senderEmail string
	if err := a.DB.QueryRow(`SELECT name, provider, sender_name, sender_email FROM lists WHERE id=?`, listKey).
		Scan(&listName, &provider, &senderName, &senderEmail); err != nil {
		return &apiError{404, "unknown list"}
	}
	tok := make([]byte, 24)
	_, _ = rand.Read(tok)
	token := hex.EncodeToString(tok)
	_, _ = a.DB.Exec(`INSERT INTO tokens(token, list_id, email, expires_at) VALUES(?, ?, ?, ?)`,
		token, listKey, email, time.Now().Add(48*time.Hour))
	confirmURL := strings.TrimRight(a.BaseURL, "/") + "/v1/confirm?token=" + token
	go func() { _ = a.Mailer.SendConfirm(provider, email, senderName, senderEmail, confirmURL, listName) }()
	return nil
}

// deleteContact removes a contact (and any of its pending tokens).
func (a *Admin) deleteContact(w http.ResponseWriter, r *http.Request) {
	listKey := r.URL.Query().Get("list_key")
	email := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("email")))
	if listKey == "" || email == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key and email required"})
		return
	}
	if err := a.deleteContactCore(listKey, email); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"status": "deleted"})
}

// decodeContactReq parses and normalises a single-contact POST body.
func decodeContactReq(w http.ResponseWriter, r *http.Request) (contactReq, bool) {
	var req contactReq
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return req, false
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return req, false
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.ListKey == "" || req.Email == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key and email required"})
		return req, false
	}
	return req, true
}

// confirmContact marks a contact confirmed without sending mail — for
// pending signups whose confirm email was lost (e.g. SMTP outage).
func (a *Admin) confirmContact(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeContactReq(w, r)
	if !ok {
		return
	}
	if err := a.confirmContactCore(req.ListKey, req.Email); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"status": "confirmed"})
}

// resendContact issues a fresh confirm token and re-sends the email.
func (a *Admin) resendContact(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeContactReq(w, r)
	if !ok {
		return
	}
	if err := a.resendContactCore(req.ListKey, req.Email); err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"status": "sent"})
}

const bulkMaxContacts = 500

type bulkReq struct {
	Action   string       `json:"action"`
	Contacts []contactReq `json:"contacts"`
}

type bulkFailure struct {
	ListKey string `json:"list_key"`
	Email   string `json:"email"`
	Error   string `json:"error"`
}

// bulkContacts applies confirm|resend|delete to many contacts with the same
// semantics as the single-contact endpoints. Failures are reported per item.
func (a *Admin) bulkContacts(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	var req bulkReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	var op func(listKey, email string) error
	switch req.Action {
	case "confirm":
		op = a.confirmContactCore
	case "resend":
		op = a.resendContactCore
	case "delete":
		op = a.deleteContactCore
	default:
		writeJSON(w, 400, map[string]string{"error": "action must be confirm, resend or delete"})
		return
	}
	if len(req.Contacts) < 1 || len(req.Contacts) > bulkMaxContacts {
		writeJSON(w, 400, map[string]string{"error": "contacts must contain between 1 and 500 entries"})
		return
	}
	ok := 0
	failed := []bulkFailure{}
	for _, c := range req.Contacts {
		email := strings.TrimSpace(strings.ToLower(c.Email))
		var err error
		if c.ListKey == "" || email == "" {
			err = &apiError{400, "list_key and email required"}
		} else {
			err = op(c.ListKey, email)
		}
		if err != nil {
			failed = append(failed, bulkFailure{ListKey: c.ListKey, Email: email, Error: err.Error()})
			continue
		}
		ok++
	}
	writeJSON(w, 200, map[string]any{"ok": ok, "failed": failed})
}

// statsDays clamps ?days= to the nearest allowed window. 14 is the legacy
// default (and stays valid when passed explicitly).
func statsDays(r *http.Request) int {
	allowed := []int{7, 14, 30, 90}
	v, err := strconv.Atoi(r.URL.Query().Get("days"))
	if err != nil {
		return 14
	}
	best := allowed[0]
	for _, c := range allowed[1:] {
		if abs(c-v) < abs(best-v) {
			best = c
		}
	}
	return best
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

type periodTotals struct {
	Signups      int `json:"signups"`
	Confirmed    int `json:"confirmed"`
	Unsubscribed int `json:"unsubscribed"`
}

type seriesDay struct {
	Day          string `json:"day"`
	Confirmed    int    `json:"confirmed"`
	Pending      int    `json:"pending"`
	Unsubscribed int    `json:"unsubscribed"`
}

func (p *periodTotals) add(status string, n int) {
	p.Signups += n
	switch status {
	case "confirmed":
		p.Confirmed += n
	case "unsubscribed":
		p.Unsubscribed += n
	}
}

func (a *Admin) stats(w http.ResponseWriter, r *http.Request) {
	days := statsDays(r)
	var lists, confirmed, pending, unsubscribed, stale int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM lists`).Scan(&lists)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE status='confirmed'`).Scan(&confirmed)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE status='pending'`).Scan(&pending)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE status='unsubscribed'`).Scan(&unsubscribed)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE status='pending' AND created_at < datetime('now', '-48 hours')`).Scan(&stale)

	type day struct {
		Day   string `json:"day"`
		Count int    `json:"count"`
	}
	var byDay []day
	rows, err := a.DB.Query(`SELECT substr(created_at, 1, 10) AS d, COUNT(*)
		FROM contacts WHERE status='confirmed' AND d >= date('now', '-13 days')
		GROUP BY d ORDER BY d`)
	if err == nil {
		for rows.Next() {
			var d day
			_ = rows.Scan(&d.Day, &d.Count)
			byDay = append(byDay, d)
		}
		rows.Close() // SQLite runs on one connection: free it before the next query
	}
	if byDay == nil {
		byDay = []day{}
	}

	// Zero-filled daily series (oldest first, today included). Day labels come
	// from SQLite's clock so they line up with the stored UTC created_at.
	var today string
	if err := a.DB.QueryRow(`SELECT date('now')`).Scan(&today); err != nil {
		today = time.Now().UTC().Format("2006-01-02")
	}
	end, _ := time.Parse("2006-01-02", today)
	series := make([]seriesDay, days)
	idx := map[string]int{}
	for i := 0; i < days; i++ {
		d := end.AddDate(0, 0, i-(days-1)).Format("2006-01-02")
		series[i].Day = d
		idx[d] = i
	}
	prevStart := end.AddDate(0, 0, -(2*days - 1)).Format("2006-01-02")
	curStart := series[0].Day

	var period, prevPeriod periodTotals
	prows, err := a.DB.Query(`SELECT substr(created_at, 1, 10), status, COUNT(*) FROM contacts
		WHERE substr(created_at, 1, 10) >= ? GROUP BY 1, 2`, prevStart)
	if err == nil {
		for prows.Next() {
			var d, st string
			var n int
			if prows.Scan(&d, &st, &n) != nil {
				continue
			}
			if d >= curStart {
				if i, ok := idx[d]; ok {
					switch st {
					case "confirmed":
						series[i].Confirmed += n
					case "pending":
						series[i].Pending += n
					case "unsubscribed":
						series[i].Unsubscribed += n
					}
					period.add(st, n)
				}
			} else {
				prevPeriod.add(st, n)
			}
		}
		prows.Close()
	}

	// Per-list confirmed signups per day, aligned with series. Every list is
	// present, even when all zero.
	listSeries := map[string][]int{}
	if lrows, err := a.DB.Query(`SELECT id FROM lists`); err == nil {
		for lrows.Next() {
			var id string
			if lrows.Scan(&id) == nil {
				listSeries[id] = make([]int, days)
			}
		}
		lrows.Close()
	}
	if srows, err := a.DB.Query(`SELECT list_id, substr(created_at, 1, 10), COUNT(*) FROM contacts
		WHERE status='confirmed' AND substr(created_at, 1, 10) >= ? GROUP BY 1, 2`, curStart); err == nil {
		for srows.Next() {
			var id, d string
			var n int
			if srows.Scan(&id, &d, &n) != nil {
				continue
			}
			if arr, ok := listSeries[id]; ok {
				if i, ok := idx[d]; ok {
					arr[i] += n
				}
			}
		}
		srows.Close()
	}

	writeJSON(w, 200, map[string]any{
		"lists": lists, "confirmed": confirmed, "pending": pending, "by_day": byDay,
		"unsubscribed": unsubscribed, "stale_pending": stale, "days": days,
		"series": series, "period": period, "prev_period": prevPeriod, "list_series": listSeries,
	})
}

type activityEvent struct {
	Type     string `json:"type"`
	Email    string `json:"email"`
	ListKey  string `json:"list_key"`
	ListName string `json:"list_name"`
	At       string `json:"at"`
}

type activityCursor struct {
	At        string `json:"at"`
	Rank      int    `json:"rk"`
	ContactID int64  `json:"cid"`
}

func encodeActivityCursor(c activityCursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeActivityCursor(s string) (activityCursor, error) {
	var c activityCursor
	b, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil || json.Unmarshal(b, &c) != nil || c.At == "" || c.Rank < 1 || c.Rank > 3 || c.ContactID < 1 {
		return c, &apiError{400, "invalid cursor"}
	}
	return c, nil
}

// activity derives a newest-first event feed from the contact timestamps.
// cursor pages by normalized time, event type and contact id; legacy before
// remains an exclusive timestamp-only filter for older clients.
func (a *Admin) activity(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	limit := clampInt(queryInt(r, "limit", 50), 1, 200)
	listKey := r.URL.Query().Get("list_key")
	rawCursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
	before := strings.TrimSpace(r.URL.Query().Get("before"))

	parts := []string{
		`SELECT 'signup' AS type, 1 AS rk, c.id AS cid, c.email AS email, c.list_id AS list_key, COALESCE(l.name, '') AS list_name, c.created_at AS at
			FROM contacts c LEFT JOIN lists l ON l.id = c.list_id WHERE c.created_at IS NOT NULL`,
		`SELECT 'confirmed', 2, c.id, c.email, c.list_id, COALESCE(l.name, ''), c.confirmed_at
			FROM contacts c LEFT JOIN lists l ON l.id = c.list_id WHERE c.confirmed_at IS NOT NULL`,
		`SELECT 'unsubscribed', 3, c.id, c.email, c.list_id, COALESCE(l.name, ''), c.unsubscribed_at
			FROM contacts c LEFT JOIN lists l ON l.id = c.list_id WHERE c.unsubscribed_at IS NOT NULL`,
	}
	var args []any
	if listKey != "" {
		for i := range parts {
			parts[i] += ` AND c.list_id = ?`
			args = append(args, listKey)
		}
	}
	q := `SELECT type, email, list_key, list_name, at, rk, cid, strftime('%Y-%m-%d %H:%M:%f', at) AS sort_at
		FROM (` + strings.Join(parts, ` UNION ALL `) + `)`
	if rawCursor != "" {
		cursor, err := decodeActivityCursor(rawCursor)
		if err != nil {
			writeErr(w, err)
			return
		}
		q += ` WHERE (sort_at < ? OR (sort_at = ? AND (rk < ? OR (rk = ? AND cid < ?))))`
		args = append(args, cursor.At, cursor.At, cursor.Rank, cursor.Rank, cursor.ContactID)
	} else if before != "" {
		q += ` WHERE sort_at < strftime('%Y-%m-%d %H:%M:%f', ?)`
		args = append(args, before)
	}
	q += ` ORDER BY sort_at DESC, rk DESC, cid DESC LIMIT ?`
	args = append(args, limit)
	rows, err := a.DB.Query(q, args...)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	events := []activityEvent{}
	var last activityCursor
	for rows.Next() {
		var e activityEvent
		if rows.Scan(&e.Type, &e.Email, &e.ListKey, &e.ListName, &e.At, &last.Rank, &last.ContactID, &last.At) == nil {
			events = append(events, e)
		}
	}
	nextCursor := ""
	if len(events) == limit {
		nextCursor = encodeActivityCursor(last)
	}
	writeJSON(w, 200, map[string]any{"events": events, "next_cursor": nextCursor})
}

func queryInt(r *http.Request, k string, d int) int {
	v, err := strconv.Atoi(r.URL.Query().Get(k))
	if err != nil {
		return d
	}
	return v
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// csvField quotes a field when required (RFC 4180): commas, quotes, and line
// breaks otherwise break the column layout — metadata regularly contains them.
func csvField(s string) string {
	if strings.ContainsAny(s, ",\"\n\r") {
		return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
	}
	return s
}

func (a *Admin) exportCSV(w http.ResponseWriter, r *http.Request) {
	listKey := r.URL.Query().Get("list_key")
	if listKey == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key required"})
		return
	}
	rows, err := a.DB.Query(`SELECT email, status, metadata, confirmed_at, created_at FROM contacts WHERE list_id = ? ORDER BY id`, listKey)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=\"export.csv\"")
	_, _ = w.Write([]byte("email,status,metadata,confirmed_at,created_at\n"))
	for rows.Next() {
		var email, status, metadata string
		var confirmed, created sql.NullString
		_ = rows.Scan(&email, &status, &metadata, &confirmed, &created)
		_, _ = w.Write([]byte(strings.Join([]string{
			csvField(email), csvField(status), csvField(metadata), csvField(confirmed.String), csvField(created.String),
		}, ",") + "\n"))
	}
}
