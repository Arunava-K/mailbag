package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// Admin handles /admin/* (Bearer ADMIN_API_KEY).
type Admin struct {
	DB      *sql.DB
	Key     string
	origins []string
}

func NewAdmin(db *sql.DB, key, originsCSV string) *Admin {
	var origins []string
	for _, o := range strings.Split(originsCSV, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	return &Admin{DB: db, Key: key, origins: origins}
}

func (a *Admin) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if "Bearer "+a.Key != r.Header.Get("Authorization") {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
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
	mux.HandleFunc("/admin/contacts", a.cors(a.auth(a.listContacts)))
	mux.HandleFunc("/admin/stats", a.cors(a.auth(a.stats)))
	mux.HandleFunc("/admin/export", a.cors(a.auth(a.exportCSV)))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok"})
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
}

func (a *Admin) listLists(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`SELECT l.id, l.name, l.type, l.sender_name, l.sender_email, l.provider,
		l.welcome_subject, l.welcome_body, l.confirm_redirect,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='confirmed') AS confirmed,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='pending') AS pending
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
			&x.WelcomeSubject, &x.WelcomeBody, &x.ConfirmRedirect, &x.Confirmed, &x.Pending)
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
	Email       string  `json:"email"`
	Status      string  `json:"status"`
	Position    int     `json:"position"`
	ConfirmedAt *string `json:"confirmed_at"`
	CreatedAt   string  `json:"created_at"`
}

func (a *Admin) listContacts(w http.ResponseWriter, r *http.Request) {
	listKey := r.URL.Query().Get("list_key")
	if listKey == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key required"})
		return
	}
	status := r.URL.Query().Get("status") // confirmed|pending|unsubscribed|""
	q := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("q")))
	limit := clampInt(queryInt(r, "limit", 50), 1, 500)
	offset := clampInt(queryInt(r, "offset", 0), 0, 1<<30)

	where := `list_id = ?`
	args := []any{listKey}
	if status == "confirmed" || status == "pending" || status == "unsubscribed" {
		where += ` AND status = ?`
		args = append(args, status)
	}
	if q != "" {
		where += ` AND lower(email) LIKE ?`
		args = append(args, "%"+q+"%")
	}
	var total int
	if err := a.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE `+where, args...).Scan(&total); err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	args = append(args, limit, offset)
	rows, err := a.DB.Query(`SELECT email, status, position, confirmed_at, created_at FROM contacts
		WHERE `+where+` ORDER BY id DESC LIMIT ? OFFSET ?`, args...)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	var out []contactRow
	for rows.Next() {
		var c contactRow
		var confirmed sql.NullString
		_ = rows.Scan(&c.Email, &c.Status, &c.Position, &confirmed, &c.CreatedAt)
		if confirmed.Valid {
			s := confirmed.String
			c.ConfirmedAt = &s
		}
		out = append(out, c)
	}
	if out == nil {
		out = []contactRow{}
	}
	writeJSON(w, 200, map[string]any{"total": total, "contacts": out})
}

func (a *Admin) stats(w http.ResponseWriter, r *http.Request) {
	var lists, confirmed, pending int
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM lists`).Scan(&lists)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE status='confirmed'`).Scan(&confirmed)
	_ = a.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE status='pending'`).Scan(&pending)

	type day struct {
		Day   string `json:"day"`
		Count int    `json:"count"`
	}
	var byDay []day
	rows, err := a.DB.Query(`SELECT substr(created_at, 1, 10) AS d, COUNT(*)
		FROM contacts WHERE status='confirmed' AND d >= date('now', '-13 days')
		GROUP BY d ORDER BY d`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d day
			_ = rows.Scan(&d.Day, &d.Count)
			byDay = append(byDay, d)
		}
	}
	if byDay == nil {
		byDay = []day{}
	}
	writeJSON(w, 200, map[string]any{
		"lists": lists, "confirmed": confirmed, "pending": pending, "by_day": byDay,
	})
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

func (a *Admin) exportCSV(w http.ResponseWriter, r *http.Request) {
	listKey := r.URL.Query().Get("list_key")
	if listKey == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key required"})
		return
	}
	rows, err := a.DB.Query(`SELECT email, status, confirmed_at, created_at FROM contacts WHERE list_id = ? ORDER BY id`, listKey)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=\"export.csv\"")
	_, _ = w.Write([]byte("email,status,confirmed_at,created_at\n"))
	for rows.Next() {
		var email, status string
		var confirmed, created sql.NullString
		_ = rows.Scan(&email, &status, &confirmed, &created)
		_, _ = w.Write([]byte(strings.Join([]string{email, status, confirmed.String, created.String}, ",") + "\n"))
	}
}
