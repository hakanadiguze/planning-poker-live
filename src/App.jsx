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
  const [session, setSession] = useState({ votes: {}, revealed: false, story: "User story to estimate...", team: {} });
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState("");
  const [newMemberName, setNewMemberName] = useState("");

  useEffect(() => {
    const sessionRef = ref(db, "session");
    const unsub = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSession(prev => {
        if (prev.revealed === true && data.revealed === false) {
          setSelectedCard(null);
          setSubmitted(false);
        }
        return data;
      });
    });
    return () => unsub();
  }, []);

  const team = session.team || {};
  const teamNames = Object.keys(team);
  const votes = session.votes || {};
  const revealed = session.revealed || false;
  const story = session.story || "";
  const voteValues = Object.values(votes);
  const numericVotes = voteValues.filter(v => v !== "Huge").map(Number);
  const tally = voteValues.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const mostVoted = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const highest = numericVotes.length ? Math.max(...numericVotes) : null;
  const lowest = numericVotes.length ? Math.min(...numericVotes) : null;
  const highestVoter = Object.entries(votes).find(([, v]) => v === String(highest))?.[0];
  const lowestVoter = Object.entries(votes).find(([, v]) => v === String(lowest))?.[0];
  const votedCount = Object.keys(votes).length;
  const totalCount = teamNames.length;

  const handleJoinAsVoter = () => { if (name) setScreen("voter"); };

const handleJoinAsMaster = () => {
    onValue(ref(db, "session/revealed"), (snap) => {
      if (snap.val() === null) {
        set(ref(db, "session/revealed"), false);
        set(ref(db, "session/story"), "User story to estimate...");
      }
    }, { onlyOnce: true });
    setScreen("master");
  };

  const handleSubmitVote = async () => {
    if (!selectedCard) return;
    await set(ref(db, `session/votes/${name}`), selectedCard);
    setSubmitted(true);
  };

  const handleReveal = () => update(ref(db, "session"), { revealed: true });

  const handleReset = async () => {
    await set(ref(db, "session/votes"), null);
    await set(ref(db, "session/revealed"), false);
  };

  const handleStoryChange = (s) => update(ref(db, "session"), { story: s });

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    await set(ref(db, `session/team/${newMemberName.trim()}`), true);
    setNewMemberName("");
  };

  const handleRemoveMember = async (memberName) => {
    await remove(ref(db, `session/team/${memberName}`));
    await remove(ref(db, `session/votes/${memberName}`));
  };

  // ── JOIN ────────────────────────────────────────────────────────
  if (screen === "join") {
    return (
      <div style={s.page}>
        <div style={s.joinCard}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🃏</div>
          <h1 style={s.title}>Planning Poker</h1>
          <p style={{ color: "#444", fontSize: 13, marginBottom: 28 }}>Sprint estimation for agile teams</p>

          <div style={{ display: "flex", background: "#0f0f1a", borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {["voter", "master"].map(r => (
              <button key={r} onClick={() => { setRole(r); setPasswordError(false); }} style={{
                flex: 1, padding: "10px 0", borderRadius: 9, border: "none",
                background: role === r ? "#F0A500" : "transparent",
                color: role === r ? "#1a1a2e" : "#555",
                fontWeight: role === r ? 700 : 400,
                cursor: "pointer", fontSize: 13, transition: "all 0.2s",
              }}>
                {r === "voter" ? "👨‍💻 Developer" : "🎯 Scrum Master"}
              </button>
            ))}
          </div>

          {role === "voter" ? (
            <>
              <div style={s.field}>
                <label style={s.label}>SELECT YOUR NAME</label>
                <select style={{ ...s.input, cursor: "pointer" }} value={name} onChange={e => setName(e.target.value)}>
                  <option value="">— Choose your name —</option>
                  {teamNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {teamNames.length === 0 && (
                  <p style={{ color: "#333", fontSize: 12, marginTop: 8 }}>⏳ Waiting for Scrum Master to add team members...</p>
                )}
              </div>
              <button style={{ ...s.btn, opacity: name ? 1 : 0.4 }} onClick={handleJoinAsVoter} disabled={!name}>
                Join Session →
              </button>
            </>
          ) : (
            <>
              <button style={s.btn} onClick={handleJoinAsMaster}>Enter as Scrum Master →</button>
            </>
          )}

          <p style={{ color: "#2a2a3e", fontSize: 11, marginTop: 28 }}>
            Built by <span style={{ color: "#F0A500" }}>Hakan</span>
          </p>
        </div>
      </div>
    );
  }

  // ── VOTER ───────────────────────────────────────────────────────
  if (screen === "voter") {
    return (
      <div style={s.page}>
        <div style={{ width: "100%", maxWidth: 680 }}>
          <div style={s.header}>
            <span style={s.badge}>👨‍💻 {name}</span>
            <span style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center" }}>📋 {story}</span>
            <span style={s.badge}>{votedCount}/{totalCount} voted</span>
          </div>

          {revealed ? (
            <div style={{ background: "#1a2535", color: "#45B7D1", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24, fontSize: 14 }}>
              🃏 Scrum Master revealed the votes!
            </div>
          ) : !submitted ? (
            <p style={{ color: "#555", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Pick your estimate — others can't see your vote yet</p>
          ) : (
            <div style={{ background: "#1a2e1a", color: "#06D6A0", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24, fontSize: 14 }}>
              ✅ Vote submitted! Waiting for Scrum Master to reveal...
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {CARDS.map(card => (
              <button key={card} onClick={() => !submitted && !revealed && setSelectedCard(card)}
                disabled={submitted || revealed}
                style={{
                  aspectRatio: "2/3", borderRadius: 12,
                  border: `2px solid ${selectedCard === card ? CARD_COLORS[card] : "#1e1e30"}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: selectedCard === card ? CARD_COLORS[card] : "#1a1a2e",
                  color: selectedCard === card ? "#1a1a2e" : "#ccc",
                  transform: selectedCard === card ? "translateY(-10px) scale(1.06)" : "translateY(0)",
                  boxShadow: selectedCard === card ? `0 10px 28px ${CARD_COLORS[card]}55` : "0 2px 8px rgba(0,0,0,0.4)",
                  cursor: submitted || revealed ? "not-allowed" : "pointer",
                  opacity: (submitted || revealed) && selectedCard !== card ? 0.35 : 1,
                  transition: "all 0.2s ease",
                }}>
                <span style={{ fontSize: card === "Huge" ? 18 : 26, fontWeight: 800 }}>{card}</span>
                <span style={{ fontSize: 9, opacity: 0.5, marginTop: 3 }}>pts</span>
              </button>
            ))}
          </div>

          {!submitted && !revealed && (
            <button style={{ ...s.btn, opacity: selectedCard ? 1 : 0.4 }} onClick={handleSubmitVote} disabled={!selectedCard}>
              Submit Vote 🚀
            </button>
          )}

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
            {teamNames.map(p => (
              <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 13, transition: "all 0.3s",
                  background: votes[p] ? "#F0A500" : "#1e1e30",
                  color: votes[p] ? "#1a1a2e" : "#444",
                  border: p === name ? "2px solid #F0A500" : "2px solid transparent",
                }}>
                  {revealed && votes[p] ? votes[p] : votes[p] ? "✓" : "?"}
                </div>
                <span style={{ fontSize: 10, color: p === name ? "#F0A500" : "#555" }}>{p}</span>
              </div>
            ))}
          </div>

          <p style={{ color: "#1a1a2e", fontSize: 11, marginTop: 32, textAlign: "center" }}>
            Built by <span style={{ color: "#2a2a3e" }}>Hakan</span>
          </p>
        </div>
      </div>
    );
  }

  // ── SCRUM MASTER ─────────────────────────────────────────────────
  if (screen === "master") {
    return (
      <div style={s.page}>
        <div style={{ width: "100%", maxWidth: 920 }}>
          <div style={s.header}>
            <span style={s.badge}>🎯 Scrum Master</span>
            {editingStory ? (
              <input autoFocus
                style={{ ...s.input, flex: 1, margin: "0 12px", fontSize: 13, padding: "8px 12px" }}
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>

            {/* Left: cards + actions + results */}
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 14, marginBottom: 20 }}>
                {teamNames.map(p => (
                  <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 76, height: 106, borderRadius: 12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 26, fontWeight: 800, border: "2px solid #1e1e30",
                      background: revealed && votes[p] ? CARD_COLORS[votes[p]] || "#555" : "#1a1a2e",
                      color: revealed && votes[p] ? "#1a1a2e" : "#2a2a3e",
                      transition: "all 0.5s ease",
                    }}>
                      {revealed && votes[p] ? votes[p] : "?"}
                    </div>
                    <span style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{p}</span>
                    {votes[p] && !revealed && <span style={{ fontSize: 10, color: "#06D6A0" }}>✓ voted</span>}
                    {!votes[p] && <span style={{ fontSize: 10, color: "#EF476F" }}>waiting...</span>}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                {!revealed ? (
                  <button style={{ ...s.btn, background: "#F0A500", color: "#1a1a2e", width: "auto", padding: "13px 36px" }} onClick={handleReveal}>
                    🃏 Reveal Votes
                  </button>
                ) : (
                  <button style={{ ...s.btn, background: "#4ECDC4", color: "#1a1a2e", width: "auto", padding: "13px 36px" }} onClick={handleReset}>
                    🔄 New Round
                  </button>
                )}
              </div>

              {revealed && voteValues.length > 0 && (
                <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 20, marginTop: 20, textAlign: "center" }}>
                  <h3 style={{ color: "#F0A500", marginBottom: 14, fontSize: 14, letterSpacing: 1 }}>RESULTS</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                    {[
                      { val: mostVoted, lbl: "Most Voted" },
                      { val: highest ?? "—", lbl: `Highest (${highestVoter || "—"})` },
                      { val: lowest ?? "—", lbl: `Lowest (${lowestVoter || "—"})` },
                    ].map(({ val, lbl }) => (
                      <div key={lbl} style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px 8px" }}>
                        <div style={{ color: "#F0A500", fontSize: 26, fontWeight: 800 }}>{val}</div>
                        <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                  {Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([card, count]) => (
                    <div key={card} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <span style={{ background: CARD_COLORS[card] || "#555", width: 34, textAlign: "center", padding: "2px 5px", borderRadius: 5, fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>
                        {card}
                      </span>
                      <div style={{ flex: 1, background: "#0f0f1a", borderRadius: 4, height: 18 }}>
                        <div style={{ width: `${(count / totalCount) * 100}%`, height: "100%", borderRadius: 4, background: CARD_COLORS[card] || "#555", transition: "width 0.8s ease" }} />
                      </div>
                      <span style={{ color: "#555", fontSize: 11, width: 50, textAlign: "right" }}>{count} vote{count > 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Team management */}
            <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 18, height: "fit-content", position: "sticky", top: 20 }}>
              <h3 style={{ color: "#F0A500", fontSize: 13, letterSpacing: 1, margin: "0 0 14px" }}>👥 TEAM MEMBERS</h3>

              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                  style={{ ...s.input, flex: 1, padding: "9px 12px", fontSize: 13 }}
                  placeholder="Add member..."
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddMember()}
                />
                <button onClick={handleAddMember} style={{
                  background: "#F0A500", border: "none", borderRadius: 8,
                  padding: "9px 14px", cursor: "pointer", fontWeight: 700,
                  color: "#1a1a2e", fontSize: 18, flexShrink: 0,
                }}>+</button>
              </div>

              {teamNames.length === 0 ? (
                <p style={{ color: "#333", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
                  No members yet. Add your team above.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {teamNames.map(p => (
                    <div key={p} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "#0f0f1a", borderRadius: 8, padding: "8px 12px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%",
                          background: votes[p] ? "#F0A500" : "#1e1e30",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: votes[p] ? "#1a1a2e" : "#333",
                        }}>
                          {votes[p] ? "✓" : "?"}
                        </div>
                        <span style={{ color: "#ccc", fontSize: 13 }}>{p}</span>
                      </div>
                      <button onClick={() => handleRemoveMember(p)} style={{
                        background: "transparent", border: "none",
                        color: "#333", cursor: "pointer", fontSize: 16,
                        padding: "2px 6px", borderRadius: 4,
                      }}
                        onMouseEnter={e => e.target.style.color = "#EF476F"}
                        onMouseLeave={e => e.target.style.color = "#333"}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ color: "#2a2a3e", fontSize: 11, marginTop: 20, textAlign: "center" }}>
                Built by <span style={{ color: "#333" }}>Hakan</span>
              </p>
            </div>
          </div>
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
    background: "#1a1a2e", borderRadius: 20, padding: "44px 40px",
    width: "100%", maxWidth: 400, textAlign: "center",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)", marginTop: 40,
  },
  title: { color: "#fff", fontSize: 30, margin: "0 0 4px", fontWeight: 800, letterSpacing: 1 },
  field: { textAlign: "left", marginBottom: 18 },
  label: { color: "#555", fontSize: 11, display: "block", marginBottom: 7, letterSpacing: 1 },
  input: {
    width: "100%", padding: "11px 14px", background: "#0f0f1a",
    border: "1px solid #2a2a3e", borderRadius: 9, color: "#fff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  },
  btn: {
    background: "#F0A500", color: "#1a1a2e", border: "none",
    borderRadius: 50, padding: "13px 32px", fontSize: 15,
    fontWeight: 700, cursor: "pointer", width: "100%", transition: "opacity 0.2s",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#1a1a2e", borderRadius: 12, padding: "11px 18px",
    marginBottom: 20, gap: 12, flexWrap: "wrap",
  },
  badge: {
    background: "#0f0f1a", color: "#F0A500", padding: "5px 13px",
    borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
  },
};
