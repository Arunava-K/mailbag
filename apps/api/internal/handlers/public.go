package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"

	"mailcollector/internal/config"
	"mailcollector/internal/mailer"
)

// Public handles /v1/* (no auth, CORS open).
type Public struct {
	DB     *sql.DB
	Mailer *mailer.Mailer
	Cfg    config.Config

	mu       sync.Mutex
	hits     map[string][]time.Time
	limit    int
	window   time.Duration
}

func NewPublic(db *sql.DB, m *mailer.Mailer, cfg config.Config) *Public {
	return &Public{DB: db, Mailer: m, Cfg: cfg, hits: map[string][]time.Time{}, limit: 20, window: time.Minute}
}

func (p *Public) allow(ip string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	cut := now.Add(-p.window)
	keep := p.hits[ip][:0]
	for _, t := range p.hits[ip] {
		if t.After(cut) {
			keep = append(keep, t)
		}
	}
	if len(keep) >= p.limit {
		p.hits[ip] = keep
		return false
	}
	p.hits[ip] = append(keep, now)
	return true
}

func (p *Public) cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		next(w, r)
	}
}

func (p *Public) Routes(mux *http.ServeMux) {
	mux.HandleFunc("/v1/subscribe", p.cors(p.subscribe))
	mux.HandleFunc("/v1/confirm", p.cors(p.confirm))
	mux.HandleFunc("/v1/unsubscribe", p.cors(p.unsubscribe))
}

type subscribeReq struct {
	ListKey  string `json:"list_key"`
	Email    string `json:"email"`
	Metadata string `json:"metadata"`
	// Honeypot: bots fill it, humans leave empty.
	Website string `json:"website"`
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func (p *Public) subscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	ip := r.Header.Get("CF-Connecting-IP")
	if ip == "" {
		ip = strings.Split(r.RemoteAddr, ":")[0]
	}
	if !p.allow(ip) {
		writeJSON(w, 429, map[string]string{"error": "too many requests"})
		return
	}
	var req subscribeReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	if req.Website != "" {
		// Pretend success for bots.
		writeJSON(w, 200, map[string]string{"status": "pending"})
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if _, err := mail.ParseAddress(req.Email); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid email"})
		return
	}
	if req.ListKey == "" {
		writeJSON(w, 400, map[string]string{"error": "list_key required"})
		return
	}
	var listID, listName, listType, provider, senderName, senderEmail string
	err := p.DB.QueryRow(`SELECT id, name, type, provider, sender_name, sender_email FROM lists WHERE id = ?`, req.ListKey).Scan(&listID, &listName, &listType, &provider, &senderName, &senderEmail)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "unknown list"})
		return
	}
	if req.Metadata == "" {
		req.Metadata = "{}"
	}
	if len(req.Metadata) > 2000 {
		req.Metadata = req.Metadata[:2000]
	}

	// Upsert as pending (keep confirmed status if already confirmed).
	var existing string
	_ = p.DB.QueryRow(`SELECT status FROM contacts WHERE list_id = ? AND email = ?`, listID, req.Email).Scan(&existing)
	if existing == "confirmed" {
		writeJSON(w, 200, map[string]any{"status": "confirmed", "message": "already subscribed"})
		return
	}
	var position int
	if listType == "waitlist" {
		_ = p.DB.QueryRow(`SELECT COUNT(*) FROM contacts WHERE list_id = ?`, listID).Scan(&position)
		position++
	}
	_, err = p.DB.Exec(`INSERT INTO contacts(list_id, email, status, position, metadata)
		VALUES(?, ?, 'pending', ?, ?)
		ON CONFLICT(list_id, email) DO UPDATE SET status='pending', metadata=excluded.metadata`,
		listID, req.Email, position, req.Metadata)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}

	tok := make([]byte, 24)
	_, _ = rand.Read(tok)
	token := hex.EncodeToString(tok)
	_, _ = p.DB.Exec(`INSERT INTO tokens(token, list_id, email, expires_at) VALUES(?, ?, ?, ?)`,
		token, listID, req.Email, time.Now().Add(48*time.Hour))

	confirmURL := strings.TrimRight(p.Cfg.BaseURL, "/") + "/v1/confirm?token=" + token
	// Send async so the form stays fast.
	go func() { _ = p.Mailer.SendConfirm(provider, req.Email, senderName, senderEmail, confirmURL, listName) }()

	resp := map[string]any{"status": "pending", "message": "check inbox to confirm"}
	if listType == "waitlist" && position > 0 {
		resp["position"] = position
	}
	writeJSON(w, 200, resp)
}

func (p *Public) confirm(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", 400)
		return
	}
	var listID, email, listType, provider, senderName, senderEmail, welcomeSub, welcomeBody, redirect string
	err := p.DB.QueryRow(`SELECT t.list_id, t.email, l.type, l.provider, l.sender_name, l.sender_email, l.welcome_subject, l.welcome_body, l.confirm_redirect
		FROM tokens t JOIN lists l ON l.id = t.list_id WHERE t.token = ? AND t.expires_at > CURRENT_TIMESTAMP`, token).
		Scan(&listID, &email, &listType, &provider, &senderName, &senderEmail, &welcomeSub, &welcomeBody, &redirect)
	if err != nil {
		http.Error(w, "invalid or expired token", 400)
		return
	}
	_, _ = p.DB.Exec(`UPDATE contacts SET status='confirmed', confirmed_at=CURRENT_TIMESTAMP WHERE list_id=? AND email=?`, listID, email)
	_, _ = p.DB.Exec(`DELETE FROM tokens WHERE token=?`, token)

	unsub := strings.TrimRight(p.Cfg.BaseURL, "/") + "/v1/unsubscribe"
	go func() { _ = p.Mailer.SendWelcome(provider, email, senderName, senderEmail, welcomeSub, welcomeBody, unsub) }()

	if redirect != "" {
		http.Redirect(w, r, redirect, http.StatusFound)
		return
	}
	w.Header().Set("Content-Type", "text/html")
	_, _ = w.Write([]byte(`<html><body style="font-family:sans-serif;text-align:center;padding:64px"><h2>You're confirmed.</h2><p>You can close this tab.</p></body></html>`))
}

func (p *Public) unsubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		// Allow GET unsub from email links: /v1/unsubscribe?list_key=&email=
		if r.Method == "GET" {
			listKey, email := r.URL.Query().Get("list_key"), strings.ToLower(r.URL.Query().Get("email"))
			if listKey != "" && email != "" {
				_, _ = p.DB.Exec(`UPDATE contacts SET status='unsubscribed' WHERE list_id=? AND email=?`, listKey, email)
				w.Header().Set("Content-Type", "text/html")
				_, _ = w.Write([]byte(`<html><body style="font-family:sans-serif;text-align:center;padding:64px"><h2>Unsubscribed.</h2></body></html>`))
				return
			}
		}
		writeJSON(w, 405, map[string]string{"error": "method not allowed"})
		return
	}
	var req subscribeReq
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	_, _ = p.DB.Exec(`UPDATE contacts SET status='unsubscribed' WHERE list_id=? AND email=?`, req.ListKey, req.Email)
	writeJSON(w, 200, map[string]string{"status": "unsubscribed"})
}
