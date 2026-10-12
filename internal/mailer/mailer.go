package mailer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/smtp"
	"time"

	"mailcollector/internal/config"
)

type Mailer struct {
	cfg    config.Config
	client *http.Client
}

func New(cfg config.Config) *Mailer {
	return &Mailer{cfg: cfg, client: &http.Client{Timeout: 15 * time.Second}}
}

// SendConfirm sends the double opt-in mail. provider is per-list ("smtp" or "plunk").
func (m *Mailer) SendConfirm(provider, to, fromName, fromEmail, confirmURL, listName string) error {
	subject := "Confirm your subscription to " + listName
	html := fmt.Sprintf(`<p>Thanks for signing up for <b>%s</b>.</p><p><a href="%s">Click here to confirm</a></p><p>If you did not request this, ignore this email.</p>`, listName, confirmURL)
	return m.send(provider, fromName, fromEmail, to, subject, html)
}

// SendWelcome sends the post-confirm welcome mail.
func (m *Mailer) SendWelcome(provider, to, fromName, fromEmail, subject, body, unsubscribeURL string) error {
	if subject == "" {
		subject = "Welcome!"
	}
	if body == "" {
		body = "<p>You're confirmed. Thanks for joining.</p>"
	}
	html := body + fmt.Sprintf(`<hr><p style="font-size:12px;color:#888"><a href="%s">Unsubscribe</a></p>`, unsubscribeURL)
	return m.send(provider, fromName, fromEmail, to, subject, html)
}

func (m *Mailer) send(provider, fromName, fromEmail, to, subject, html string) error {
	if provider == "plunk" && m.cfg.PlunkAPIKey != "" {
		return m.sendPlunk(fromName, fromEmail, to, subject, html)
	}
	return m.sendSMTP(fromName, fromEmail, to, subject, html)
}

func (m *Mailer) sendSMTP(fromName, fromEmail, to, subject, html string) error {
	if m.cfg.SMTPHost == "" {
		// No SMTP configured: log and skip (dev mode).
		fmt.Printf("[mailer] SMTP not configured, skip send to=%s subject=%q\n", to, subject)
		return nil
	}
	from := m.cfg.SMTPFrom
	if fromEmail != "" {
		from = fromEmail
	}
	msg := bytes.Buffer{}
	msg.WriteString(fmt.Sprintf("From: %s <%s>\r\n", fromName, from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString(`Content-Type: text/html; charset="UTF-8"` + "\r\n\r\n")
	msg.WriteString(html)

	addr := m.cfg.SMTPHost + ":" + m.cfg.SMTPPort
	var auth smtp.Auth
	if m.cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", m.cfg.SMTPUser, m.cfg.SMTPPass, m.cfg.SMTPHost)
	}
	return smtp.SendMail(addr, auth, from, []string{to}, msg.Bytes())
}

func (m *Mailer) sendPlunk(fromName, fromEmail, to, subject, html string) error {
	from := m.cfg.SMTPFrom
	if fromEmail != "" {
		from = fromEmail
	}
	payload := map[string]string{
		"from":    from,
		"to":      to,
		"subject": subject,
		"body":    html,
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.useplunk.com/v1/send", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+m.cfg.PlunkAPIKey)
	resp, err := m.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("plunk: status %d", resp.StatusCode)
	}
	return nil
}
