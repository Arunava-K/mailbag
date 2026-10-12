package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
)

// Admin handles /admin/* (Bearer ADMIN_API_KEY).
type Admin struct {
	DB  *sql.DB
	Key string
}

func NewAdmin(db *sql.DB, key string) *Admin { return &Admin{DB: db, Key: key} }

func (a *Admin) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if "Bearer "+a.Key != r.Header.Get("Authorization") {
			writeJSON(w, 401, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

func (a *Admin) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/admin/lists", a.auth(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			a.listLists(w, r)
		case "POST":
			a.createList(w, r)
		default:
			writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		}
	}))
	mux.HandleFunc("/admin/export", a.auth(a.exportCSV))
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
	if req.Type != "waitlist" {
		req.Type = "newsletter"
	}
	if req.Provider != "plunk" {
		req.Provider = "smtp"
	}
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	id := "pk_" + hex.EncodeToString(b)
	_, err := a.DB.Exec(`INSERT INTO lists(id, name, type, sender_name, sender_email, provider, welcome_subject, welcome_body, confirm_redirect)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, req.Name, req.Type, req.SenderName, req.SenderEmail, req.Provider, req.WelcomeSubject, req.WelcomeBody, req.ConfirmRedirect)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, 201, map[string]string{"list_key": id, "name": req.Name})
}

func (a *Admin) listLists(w http.ResponseWriter, r *http.Request) {
	rows, err := a.DB.Query(`SELECT l.id, l.name, l.type, l.sender_email, l.provider,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='confirmed') AS confirmed,
		(SELECT COUNT(*) FROM contacts c WHERE c.list_id = l.id AND c.status='pending') AS pending
		FROM lists l ORDER BY l.created_at DESC`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()
	type row struct {
		Key string `json:"list_key"`
		Name string `json:"name"`
		Type string `json:"type"`
		SenderEmail string `json:"sender_email"`
		Provider string `json:"provider"`
		Confirmed int `json:"confirmed"`
		Pending int `json:"pending"`
	}
	var out []row
	for rows.Next() {
		var x row
		_ = rows.Scan(&x.Key, &x.Name, &x.Type, &x.SenderEmail, &x.Provider, &x.Confirmed, &x.Pending)
		out = append(out, x)
	}
	if out == nil {
		out = []row{}
	}
	writeJSON(w, 200, out)
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
