import { useState, useEffect } from "react";
import { db } from "./firebase";
import { ref, set, onValue, remove, update } from "firebase/database";

const CARDS = ["1", "2", "3", "5", "8", "13", "21", "Huge"];
const CARD_COLORS = {
  "1": "#4ECDC4", "2": "#45B7D1", "3": "#96CEB4",
  "5": "#FFEAA7", "8": "#DDA0DD", "13": "#F0A500",
  "21": "#FF6B6B", "Huge": "#2D3436"
};

export default function PlanningPoker() {
  const [screen, setScreen] = useState("join");
  const [name, setName] = useState("");
  const [role, setRole] = useState("voter");
  const [selectedCard, setSelectedCard] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState({ votes: {}, revealed: false, story: "User story..." });
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState("");

  // Listen to Firebase in real time
  useEffect(() => {
    if (screen === "join") return;
    const sessionRef = ref(db, "session");
    const unsub = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setSession(data);
    });
    return () => unsub();
  }, [screen]);

  // Join session
  const handleJoin = async () => {
    if (!name.trim()) return;
    // Register participant
    await update(ref(db, `session/participants/${name}`), { role });
    // Initialize session if not exists
    const sessionRef = ref(db, "session/revealed");
    onValue(sessionRef, (snap) => {
      if (snap.val() === null) {
        set(ref(db, "session/revealed"), false);
        set(ref(db, "session/story"), "User story to estimate...");
      }
    }, { onlyOnce: true });
    setScreen(role === "master" ? "master" : "voter");
  };

  // Submit vote
  const handleVote = async (card) => {
    if (submitted) return;
    setSelectedCard(card);
  };

  const handleSubmit = async () => {
    if (!selectedCard) return;
    await set(ref(db, `session/votes/${name}`), selectedCard);
    setSubmitted(true);
  };

  // Scrum master actions
  const handleReveal = () => update(ref(db, "session"), { revealed: true });

  const handleReset = async () => {
    await set(ref(db, "session/votes"), null);
    await set(ref(db, "session/revealed"), false);
    setSelectedCard(null);
    setSubmitted(false);
  };

  const handleStoryChange = (story) => update(ref(db, "session"), { story });

  // Derived stats
  const votes = session.votes || {};
  const participants = session.participants || {};
  const revealed = session.revealed || false;
  const story = session.story || "";

  const voterNames = Object.keys(participants);
  const voteValues = Object.values(votes);
  const numericVotes = voteValues.filter(v => v !== "Huge").map(Number);
  const tally = voteValues.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const mostVoted = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const highest = numericVotes.length ? Math.max(...numericVotes) : null;
  const lowest = numericVotes.length ? Math.min(...numericVotes) : null;
  const highestVoter = Object.entries(votes).find(([, v]) => v === String(highest))?.[0];
  const lowestVoter = Object.entries(votes).find(([, v]) => v === String(lowest))?.[0];
  const votedCount = Object.keys(votes).length;
  const totalCount = voterNames.length;

  // ─── JOIN ──────────────────────────────────────────────────────
  if (screen === "join") {
    return (
      <div style={s.page}>
        <div style={s.joinCard}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🃏</div>
          <h1 style={s.title}>Planning Poker</h1>
          <p style={{ color: "#555", fontSize: 14, marginBottom: 32 }}>Live sprint estimation</p>

          <div style={s.field}>
            <label style={s.label}>YOUR NAME</label>
            <input
              style={s.input}
              placeholder="e.g. Sarah"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>JOIN AS</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["voter", "master"].map(r => (
                <button key={r} onClick={() => setRole(r)} style={{
                  ...s.roleBtn,
                  background: role === r ? "#F0A500" : "#2a2a3e",
                  color: role === r ? "#1a1a2e" : "#aaa",
                  fontWeight: role === r ? 700 : 400,
                }}>
                  {r === "voter" ? "👨‍💻 Developer" : "🎯 Scrum Master"}
                </button>
              ))}
            </div>
          </div>

          <button
            style={{ ...s.btn, opacity: name.trim() ? 1 : 0.5 }}
            onClick={handleJoin}
          >
            Join Session →
          </button>
        </div>
      </div>
    );
  }

  // ─── VOTER ─────────────────────────────────────────────────────
  if (screen === "voter") {
    return (
      <div style={s.page}>
        <div style={{ width: "100%", maxWidth: 700 }}>
          <div style={s.header}>
            <span style={s.badge}>👨‍💻 {name}</span>
            <span style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center" }}>📋 {story}</span>
            <span style={s.badge}>{votedCount}/{totalCount} voted</span>
          </div>

          {revealed ? (
            <div style={{ background: "#1a2e2a", color: "#06D6A0", padding: "14px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24 }}>
              🃏 Scrum Master revealed the votes!
            </div>
          ) : !submitted ? (
            <p style={{ color: "#888", textAlign: "center", marginBottom: 24, fontSize: 14 }}>
              Pick your estimate — others can't see your vote yet
            </p>
          ) : (
            <div style={{ background: "#1a2e1a", color: "#06D6A0", padding: "14px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24 }}>
              ✅ Vote submitted! Waiting for Scrum Master to reveal...
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            {CARDS.map(card => (
              <button key={card} onClick={() => handleVote(card)} disabled={submitted || revealed} style={{
                aspectRatio: "2/3", borderRadius: 12,
                border: "2px solid #2a2a3e",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: selectedCard === card ? CARD_COLORS[card] : "#1e1e30",
                color: selectedCard === card ? "#1a1a2e" : "#ccc",
                transform: selectedCard === card ? "translateY(-12px) scale(1.08)" : "translateY(0)",
                boxShadow: selectedCard === card ? `0 12px 30px ${CARD_COLORS[card]}66` : "0 4px 12px rgba(0,0,0,0.4)",
                cursor: submitted || revealed ? "not-allowed" : "pointer",
                opacity: (submitted || revealed) && selectedCard !== card ? 0.4 : 1,
                transition: "all 0.25s ease",
              }}>
                <span style={{ fontSize: card === "Huge" ? 20 : 28, fontWeight: 800 }}>{card}</span>
                <span style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>pts</span>
              </button>
            ))}
          </div>

          {!submitted && !revealed && (
            <button style={{ ...s.btn, opacity: selectedCard ? 1 : 0.4 }} onClick={handleSubmit} disabled={!selectedCard}>
              Submit Vote 🚀
            </button>
          )}

          {/* Participants status */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
            {voterNames.map(p => (
              <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14, transition: "all 0.3s",
                  background: votes[p] ? "#F0A500" : "#2a2a3e",
                  color: votes[p] ? "#1a1a2e" : "#555",
                }}>
                  {revealed && votes[p] ? votes[p] : votes[p] ? "✓" : "?"}
                </div>
                <span style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── SCRUM MASTER ──────────────────────────────────────────────
  if (screen === "master") {

    return (
      <div style={s.page}>
        <div style={{ width: "100%", maxWidth: 860 }}>
          <div style={s.header}>
            <span style={s.badge}>🎯 Scrum Master</span>
            {editingStory ? (
              <input
                autoFocus
                style={{ ...s.input, flex: 1, margin: "0 12px", fontSize: 13 }}
                value={storyDraft}
                onChange={e => setStoryDraft(e.target.value)}
                onBlur={() => { handleStoryChange(storyDraft); setEditingStory(false); }}
                onKeyDown={e => e.key === "Enter" && (handleStoryChange(storyDraft), setEditingStory(false))}
              />
            ) : (
              <span onClick={() => { setStoryDraft(story); setEditingStory(true); }}
                style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center", cursor: "pointer" }}>
                📋 {story} ✏️
              </span>
            )}
            <span style={s.badge}>{votedCount}/{totalCount} voted</span>
          </div>

          {/* Participants & cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 16, marginBottom: 8 }}>
            {voterNames.map(p => (
              <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 80, height: 110, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, fontWeight: 800, border: "2px solid #2a2a3e",
                  background: revealed && votes[p] ? CARD_COLORS[votes[p]] || "#555" : "#1e1e30",
                  color: revealed && votes[p] ? "#1a1a2e" : "#333",
                  transition: "all 0.5s ease",
                }}>
                  {revealed && votes[p] ? votes[p] : "?"}
                </div>
                <span style={{ fontSize: 12, color: "#888", marginTop: 8 }}>{p}</span>
                {!votes[p] && <span style={{ fontSize: 10, color: "#f00" }}>not voted</span>}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", margin: "24px 0" }}>
            {!revealed ? (
              <button style={{ ...s.btn, background: "#F0A500", color: "#1a1a2e", width: "auto", padding: "14px 40px" }}
                onClick={handleReveal}>
                🃏 Reveal Votes
              </button>
            ) : (
              <button style={{ ...s.btn, background: "#4ECDC4", color: "#1a1a2e", width: "auto", padding: "14px 40px" }}
                onClick={handleReset}>
                🔄 New Round
              </button>
            )}
          </div>

          {/* Results */}
          {revealed && voteValues.length > 0 && (
            <div style={{ background: "#1a1a2e", borderRadius: 16, padding: 24, textAlign: "center" }}>
              <h3 style={{ color: "#F0A500", marginBottom: 16, fontSize: 16, letterSpacing: 1 }}>RESULTS</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
                {[
                  { val: mostVoted, lbl: "Most Voted" },
                  { val: highest ?? "—", lbl: `Highest (${highestVoter || "—"})` },
                  { val: lowest ?? "—", lbl: `Lowest (${lowestVoter || "—"})` },
                ].map(({ val, lbl }) => (
                  <div key={lbl} style={{ background: "#0f0f1a", borderRadius: 12, padding: "16px 8px" }}>
                    <div style={{ color: "#F0A500", fontSize: 28, fontWeight: 800 }}>{val}</div>
                    <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{lbl}</div>
                  </div>
                ))}
              </div>

              <p style={{ color: "#555", fontSize: 12, marginBottom: 10 }}>VOTE DISTRIBUTION</p>
              {Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([card, count]) => (
                <div key={card} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ background: CARD_COLORS[card] || "#555", width: 36, textAlign: "center", padding: "3px 6px", borderRadius: 6, fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>
                    {card}
                  </span>
                  <div style={{ flex: 1, background: "#0f0f1a", borderRadius: 4, height: 20 }}>
                    <div style={{ width: `${(count / totalCount) * 100}%`, height: "100%", borderRadius: 4, background: CARD_COLORS[card] || "#555", transition: "width 0.8s ease" }} />
                  </div>
                  <span style={{ color: "#666", fontSize: 12, width: 55, textAlign: "right" }}>{count} vote{count > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
}

const s = {
  page: {
    minHeight: "100vh", background: "#0f0f1a",
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    fontFamily: "'Georgia', serif", padding: "30px 16px",
  },
  joinCard: {
    background: "#1a1a2e", borderRadius: 20, padding: "48px 40px",
    width: "100%", maxWidth: 420, textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)", marginTop: 40,
  },
  title: { color: "#fff", fontSize: 32, margin: 0, fontWeight: 800, letterSpacing: 1 },
  field: { textAlign: "left", marginBottom: 20 },
  label: { color: "#888", fontSize: 12, display: "block", marginBottom: 8, letterSpacing: 1 },
  input: {
    width: "100%", padding: "12px 16px", background: "#0f0f1a",
    border: "1px solid #2a2a3e", borderRadius: 10, color: "#fff",
    fontSize: 15, outline: "none", boxSizing: "border-box",
  },
  roleBtn: {
    flex: 1, padding: "12px 8px", borderRadius: 10, border: "none",
    cursor: "pointer", fontSize: 13, transition: "all 0.2s",
  },
  btn: {
    background: "#F0A500", color: "#1a1a2e", border: "none",
    borderRadius: 50, padding: "14px 36px", fontSize: 16,
    fontWeight: 700, cursor: "pointer", width: "100%",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#1a1a2e", borderRadius: 12, padding: "12px 20px",
    marginBottom: 24, gap: 12, flexWrap: "wrap",
  },
  badge: {
    background: "#0f0f1a", color: "#F0A500", padding: "6px 14px",
    borderRadius: 20, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
  },
};
