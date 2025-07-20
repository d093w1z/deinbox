# DeInbox 🧹📬

**DeInbox** is a privacy-focused, smart Gmail inbox cleaner that helps you take control of your cluttered inbox. From bulk deletion and one-click unsubscription to intelligent cleanup recommendations, DeInbox simplifies email management for a healthier digital life.

---

## ✨ Features

### 🔐 Secure Gmail Integration

- OAuth 2.0-based Google Sign-In
- Gmail API integration with read/delete/manage access
- Token refresh handling

### 📥 Inbox Management

- View inbox metrics (total, unread, categories, sizes)
- Filter emails by:
  - Age (e.g., older than 1 year)
  - Category (Promotions, Social, Forums, Updates)
  - Attachment size
  - Sender frequency
- Bulk delete/archive selected emails

### 📤 Unsubscribe Assistant

- Detect newsletters and mailing lists
- One-click unsubscribe using `List-Unsubscribe` headers

### 🧠 Smart Cleanup (Coming Soon)

- AI-based suggestions on emails to delete
- Personalized cleanup rules (e.g., "Auto-delete XYZ after 3 months")
- Interaction-based prioritization

### 🛡️ Privacy & Security

- GDPR & CCPA-compliant
- No email data stored beyond session tokens
- Full data deletion and export options

---

## 🧪 Tech Stack

- **Frontend**: Next.js + Tailwind CSS
- **Backend**: Node.js (Express)
- **Authentication**: Google OAuth 2.0
- **APIs**: Gmail REST API
- **Database**: MongoDB

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/deinbox.git
cd deinbox
```

### 2. Create a Google Cloud OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Gmail API
4. Create OAuth credentials
5. Set your authorized redirect URIs

Copy your `CLIENT_ID` and `CLIENT_SECRET`.

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
CLIENT_ID=your-google-oauth-client-id
CLIENT_SECRET=your-google-oauth-client-secret
REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=some_random_string
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Start the App

```bash
npm run dev
```

---

## 🧭 Roadmap

- [ ] 🔐 Phase 1: Authentication & Setup (Priority: High)
- [ ] 📥 Phase 2: Email Fetching & Filtering (Priority: High)
- [ ] 🧹 Phase 3: Bulk Actions (Priority: High)
- [ ] 📤 Phase 4: Unsubscribe Assistant (Priority: Medium)
- [ ] 🧠 Phase 5: Smart Cleanup Suggestions (Priority: Low for MVP)
- [ ] 🛠 Phase 6: UI/UX & Infrastructure (Priority: Medium)
- [ ] 🧾 Phase 7: Final Touches & Compliance (Priority: Medium)

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!

1. Fork the repository
2. Create a new branch (`git checkout -b feature-xyz`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature-xyz`)
5. Open a pull request

---

## 📜 License

[MIT](LICENSE)

---

## 📬 Contact

Created by [d093w1z](https://d093w1z.com)
Feel free to reach out at: [contact-github@d093w1z.com](mailto:contact-github@d093w1z.com)
