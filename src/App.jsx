import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

const PROJECT_TYPES = ["Ground up", "TFO", "Conversion", "Site Adapt", "Site Adapt - Modification", "Patio Addition", "Tenant Finish out"];
const MANAGERS = ["MJ", "EM", "SAS", "SAS/MJ", "MJ/EM"];
const STATES = ["TX", "TN", "GA", "CO", "FL"];

// ── Helpers ──────────────────────────────────────────────
function formatDate(d) {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}
function formatCurrency(n) { return "$" + Number(n).toLocaleString(); }
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr + "T00:00:00") - now) / 86400000);
}
function getDeadlineStatus(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0) return "overdue"; if (d <= 7) return "urgent"; if (d <= 14) return "warning"; return "ok";
}

function getProjectStatus(p) {
  if (p.holdDate) return { label: "Hold – " + formatDate(p.holdDate), key: "hold" };
  if (p.pcd && daysUntil(p.pcd) < 0) return { label: "Completed", key: "completed" };
  return { label: "Current", key: "current" };
}

// Map DB row → app object
function rowToProject(r) {
  return { id: r.id, name: r.name, number: r.number, state: r.state, manager: r.manager, type: r.type, goBy: r.go_by || "", kickOff: r.kick_off || "", qcll: r.qcll || "", pcd: r.pcd || "", fee: Number(r.fee), targetHours: Number(r.target_hours), hoursSpent: Number(r.hours_spent), holdDate: r.hold_date || "" };
}
// Map app object → DB row
function projectToRow(p) {
  return { name: p.name, number: p.number, state: p.state, manager: p.manager, type: p.type, go_by: p.goBy, kick_off: p.kickOff || null, qcll: p.qcll || null, pcd: p.pcd || null, fee: p.fee, target_hours: p.targetHours, hours_spent: p.hoursSpent, hold_date: p.holdDate || null };
}

// ── Icons ────────────────────────────────────────────────
const BellIcon = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const XIcon = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const ChevronIcon = ({ dir = "down", size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: dir === "up" ? "rotate(180deg)" : "none" }}><polyline points="6 9 12 15 18 9"/></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const SendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const LoaderIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>;

// ── Styles ───────────────────────────────────────────────
const inputStyle = { width: "100%", padding: "10px 12px", background: "#12141a", border: "1px solid #2a2d35", borderRadius: 8, color: "#e8e8e8", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };
const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" };
const btnPrimary = { padding: "10px 20px", background: "#d4a053", color: "#111", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em", transition: "all 0.2s" };
const btnSecondary = { padding: "10px 20px", background: "transparent", color: "#888", border: "1px solid #333", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" };
const severityColors = { critical: "#ef4444", overdue: "#3b82f6", warning: "#f59e0b", info: "#3b82f6" };
const severityBg = { critical: "rgba(239,68,68,0.1)", overdue: "rgba(59,130,246,0.1)", warning: "rgba(245,158,11,0.08)", info: "rgba(59,130,246,0.08)" };

function statusBadge(status) {
  const c = { overdue: { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6" }, urgent: { bg: "rgba(239,68,68,0.12)", fg: "#f87171" }, warning: { bg: "rgba(245,158,11,0.12)", fg: "#fbbf24" }, ok: { bg: "rgba(34,197,94,0.1)", fg: "#4ade80" } }[status] || { bg: "rgba(34,197,94,0.1)", fg: "#4ade80" };
  return { background: c.bg, color: c.fg, padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, display: "inline-block" };
}

// ── Modal ────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}>
      <div style={{ background: "#1a1d23", border: "1px solid #2a2d35", borderRadius: 12, width, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid #2a2d35" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f0f0f0", fontFamily: "'DM Sans', sans-serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4 }}><XIcon size={20} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "#7f1d1d" : type === "success" ? "#14532d" : "#1e3a5f";
  const border = type === "error" ? "#dc2626" : type === "success" ? "#22c55e" : "#3b82f6";
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 2000, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 20px", color: "#e0e0e0", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", animation: "slideUp 0.3s ease", maxWidth: 380, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16 }}>{type === "error" ? "✕" : type === "success" ? "✓" : "ℹ"}</span>
      <span>{message}</span>
    </div>
  );
}

// ── Project Form ─────────────────────────────────────────
function ProjectForm({ project, onSave, onCancel, saving }) {
  const [form, setForm] = useState(project || { name: "", number: "", state: "TX", manager: "MJ", type: "TFO", goBy: "", kickOff: "", qcll: "", pcd: "", fee: 0, hoursSpent: 0, holdDate: "" });
  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));
  const setNum = (f) => (e) => setForm(p => ({ ...p, [f]: parseFloat(e.target.value) || 0 }));
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <div style={{ gridColumn: "1 / -1" }}><Field label="Project Name"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="e.g. The Rustic - Houston, TX" /></Field></div>
        <Field label="Project Number"><input style={inputStyle} value={form.number} onChange={set("number")} placeholder="FRC25002" /></Field>
        <Field label="Go-By"><input style={inputStyle} value={form.goBy} onChange={set("goBy")} placeholder="Reference project" /></Field>
        <Field label="State"><select style={selectStyle} value={form.state} onChange={set("state")}>{STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
        <Field label="Project Manager"><select style={selectStyle} value={form.manager} onChange={set("manager")}>{MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}</select></Field>
        <Field label="Project Type"><select style={selectStyle} value={form.type} onChange={set("type")}>{PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
        <Field label="Fee ($)"><input style={inputStyle} type="number" value={form.fee} onChange={setNum("fee")} /></Field>
        <Field label="Kick Off Date"><input style={inputStyle} type="date" value={form.kickOff} onChange={set("kickOff")} /></Field>
        <Field label="QC / LL Date"><input style={inputStyle} type="date" value={form.qcll} onChange={set("qcll")} /></Field>
        <Field label="P / CD Date"><input style={inputStyle} type="date" value={form.pcd} onChange={set("pcd")} /></Field>
        <Field label="Hours Spent"><input style={inputStyle} type="number" step="0.5" value={form.hoursSpent} onChange={setNum("hoursSpent")} /></Field>
        <Field label="Hold Date (leave empty if not on hold)">
          <div style={{ display: "flex", gap: 8 }}>
            <input style={inputStyle} type="date" value={form.holdDate} onChange={set("holdDate")} />
            {form.holdDate && <button onClick={() => setForm(f => ({ ...f, holdDate: "" }))} style={{ ...btnSecondary, padding: "8px 12px", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>Clear</button>}
          </div>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving} className="btn-hover" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: 8 }}>
          {saving && <LoaderIcon />}{project ? "Save Changes" : "Add Project"}
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────
function DashboardView({ projects, notifications, rate }) {
  const managerStats = {};
  projects.forEach(p => {
    if (!managerStats[p.manager]) managerStats[p.manager] = { count: 0, fee: 0, target: 0, spent: 0 };
    managerStats[p.manager].count++; managerStats[p.manager].fee += p.fee;
    managerStats[p.manager].target += rate > 0 ? Math.round(p.fee / rate) : 0; managerStats[p.manager].spent += p.hoursSpent;
  });
  const typeStats = {};
  projects.forEach(p => {
    if (!typeStats[p.type]) typeStats[p.type] = { count: 0, fee: 0 };
    typeStats[p.type].count++; typeStats[p.type].fee += p.fee;
  });
  const barColors = ["#d4a053", "#4ade80", "#3b82f6", "#f59e0b", "#a78bfa"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div style={{ background: "#12141a", border: "1px solid #1e2028", borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>Workload by Manager</h3>
        {Object.entries(managerStats).map(([mgr, stats], i) => {
          const maxFee = Math.max(...Object.values(managerStats).map(s => s.fee));
          return (<div key={mgr} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>{mgr}</span><span style={{ fontSize: 12, color: "#888", fontFamily: "'Space Mono', monospace" }}>{stats.count} projects · {formatCurrency(stats.fee)}</span></div>
            <div style={{ height: 8, background: "#1a1d23", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(stats.fee / maxFee) * 100}%`, height: "100%", borderRadius: 4, background: barColors[i % barColors.length], transition: "width 0.6s ease" }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#666" }}><span>{stats.spent.toFixed(1)}h spent</span><span>{stats.target}h target</span></div>
          </div>);
        })}
      </div>
      <div style={{ background: "#12141a", border: "1px solid #1e2028", borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>Projects by Type</h3>
        {Object.entries(typeStats).sort((a, b) => b[1].count - a[1].count).map(([type, stats], i) => (
          <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1a1d23" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: barColors[i % barColors.length] }} /><span style={{ fontSize: 13, color: "#ccc" }}>{type}</span></div>
            <div style={{ display: "flex", gap: 20 }}><span style={{ fontSize: 12, color: "#888", fontFamily: "'Space Mono', monospace" }}>{stats.count}</span><span style={{ fontSize: 12, color: "#4ade80", fontFamily: "'Space Mono', monospace", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{formatCurrency(stats.fee)}</span></div>
          </div>
        ))}
      </div>
      <div style={{ gridColumn: "1 / -1", background: "#12141a", border: "1px solid #1e2028", borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>Upcoming Deadlines</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {notifications.filter(n => n.daysLeft >= 0).slice(0, 12).map(n => (
            <div key={n.id} style={{ background: "#0d0f14", border: "1px solid #1e2028", borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid ${severityColors[n.severity] || "#3b82f6"}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.project}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{n.type} · {formatDate(n.date)} · <span style={{ color: severityColors[n.severity], fontWeight: 700 }}>{n.daysLeft}d left</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inline Hours Input (saves reliably on blur) ──────────
function HoursInput({ projectId, value, overBudget, onSave }) {
  const [localVal, setLocalVal] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync from parent when not focused (e.g. after DB reload)
  useEffect(() => {
    if (!isFocused) setLocalVal(String(value));
  }, [value, isFocused]);

  return (
    <input
      type="number"
      step="0.5"
      value={localVal}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={() => {
        setIsFocused(false);
        const parsed = parseFloat(localVal) || 0;
        setLocalVal(String(parsed));
        if (parsed !== value) {
          onSave(projectId, parsed);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.target.blur();
        }
      }}
      style={{
        width: 64, padding: "5px 6px", textAlign: "right",
        background: overBudget ? "rgba(239,68,68,0.15)" : "#0d0f14",
        border: overBudget ? "1px solid rgba(239,68,68,0.4)" : "1px solid #1e2028",
        borderRadius: 5, color: overBudget ? "#ef4444" : "#aaa",
        fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: overBudget ? 800 : 400,
        outline: "none", transition: "all 0.2s"
      }}
    />
  );
}

// ══════════════════════════════════════════════════════════
// ── MAIN APP ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
export default function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [filterManager, setFilterManager] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [sortField, setSortField] = useState("pcd");
  const [sortDir, setSortDir] = useState("asc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifSent, setNotifSent] = useState({});
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifTarget, setNotifTarget] = useState(null);
  const [currentView, setCurrentView] = useState("table");
  const [rate, setRate] = useState(100);
  const [rateLoaded, setRateLoaded] = useState(false);

  const showToast = (message, type = "info") => setToast({ message, type });

  // ── Load rate from Supabase ──
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("settings").select("value").eq("key", "rate").single();
      if (!error && data) setRate(parseFloat(data.value) || 100);
      setRateLoaded(true);
    })();
  }, []);

  // ── Save rate to Supabase when changed (debounced) ──
  useEffect(() => {
    if (!rateLoaded) return; // don't save on initial load
    const timeout = setTimeout(async () => {
      const { error } = await supabase.from("settings").upsert({ key: "rate", value: String(rate) });
      if (error) showToast("Failed to save rate: " + error.message, "error");
    }, 500);
    return () => clearTimeout(timeout);
  }, [rate, rateLoaded]);

  // ── Fetch from Supabase ──
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("projects").select("*").order("pcd", { ascending: true });
    if (error) {
      showToast("Failed to load projects: " + error.message, "error");
      setLoading(false);
      return;
    }
    setProjects((data || []).map(rowToProject));
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase.channel("projects-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        fetchProjects(); // Re-fetch on any change
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProjects]);

  // ── Generate notifications ──
  useEffect(() => {
    const notifs = [];
    projects.forEach(p => {
      const qcDays = daysUntil(p.qcll);
      const pcdDays = daysUntil(p.pcd);
      if (qcDays >= 0 && qcDays <= 14) notifs.push({ id: `qc-${p.id}`, projectId: p.id, project: p.name, manager: p.manager, type: "QC/LL", date: p.qcll, daysLeft: qcDays, severity: qcDays <= 3 ? "critical" : qcDays <= 7 ? "warning" : "info" });
      if (pcdDays >= 0 && pcdDays <= 14) notifs.push({ id: `pcd-${p.id}`, projectId: p.id, project: p.name, manager: p.manager, type: "P/CD", date: p.pcd, daysLeft: pcdDays, severity: pcdDays <= 3 ? "critical" : pcdDays <= 7 ? "warning" : "info" });
      if (qcDays < 0) notifs.push({ id: `qc-over-${p.id}`, projectId: p.id, project: p.name, manager: p.manager, type: "QC/LL", date: p.qcll, daysLeft: qcDays, severity: "overdue" });
      if (pcdDays < 0) notifs.push({ id: `pcd-over-${p.id}`, projectId: p.id, project: p.name, manager: p.manager, type: "P/CD", date: p.pcd, daysLeft: pcdDays, severity: "overdue" });
    });
    notifs.sort((a, b) => a.daysLeft - b.daysLeft);
    setNotifications(notifs);
  }, [projects]);

  const urgentCount = notifications.filter(n => n.severity === "critical" || n.severity === "overdue").length;

  // ── CRUD: Add / Update ──
  const handleSave = async (project) => {
    setSaving(true);
    const row = projectToRow(project);
    if (project.id) {
      const { error } = await supabase.from("projects").update(row).eq("id", project.id);
      if (error) { showToast("Update failed: " + error.message, "error"); }
      else { showToast("Project updated", "success"); }
    } else {
      const { error } = await supabase.from("projects").insert([row]);
      if (error) { showToast("Insert failed: " + error.message, "error"); }
      else { showToast("Project added", "success"); }
    }
    setSaving(false);
    setShowAddModal(false);
    setEditProject(null);
    fetchProjects();
  };

  // ── CRUD: Delete ──
  const handleDelete = async (id) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) showToast("Delete failed: " + error.message, "error");
    else { showToast("Project deleted", "success"); fetchProjects(); }
  };

  // ── Notification send ──
  const handleSendNotification = (notif) => { setNotifTarget(notif); setShowNotifModal(true); };
  const confirmSendNotif = () => {
    if (notifTarget) {
      setNotifSent(prev => ({ ...prev, [notifTarget.id]: true }));
      showToast(`Notification sent to ${notifTarget.manager}`, "success");
    }
    setShowNotifModal(false); setNotifTarget(null);
  };

  // ── Filter & Sort ──
  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.number.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterManager !== "All" && p.manager !== filterManager) return false;
    if (filterType !== "All" && p.type !== filterType) return false;
    return true;
  }).sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const totalFee = projects.reduce((s, p) => s + p.fee, 0);
  const totalTarget = rate > 0 ? projects.reduce((s, p) => s + Math.round(p.fee / rate), 0) : 0;
  const totalSpent = projects.reduce((s, p) => s + p.hoursSpent, 0);

  const SortHeader = ({ field, children, width, align }) => (
    <th onClick={() => handleSort(field)} style={{ padding: "12px 10px", textAlign: align || "left", fontSize: 10.5, fontWeight: 700, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", width, borderBottom: "2px solid #2a2d35", background: "#13151b", position: "sticky", top: 0, zIndex: 2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{children}{sortField === field && <ChevronIcon dir={sortDir === "asc" ? "down" : "up"} />}</span>
    </th>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#0d0f14", color: "#e0e0e0", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #12141a; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        input:focus, select:focus { border-color: #d4a053 !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        tr:hover td { background: rgba(212,160,83,0.04) !important; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .btn-hover:hover { opacity: 0.85; transform: translateY(-1px); }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "#12141a", borderBottom: "1px solid #1e2028", padding: "0 32px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #d4a053, #b8862f)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#111", fontFamily: "'Space Mono', monospace" }}>SP</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#f5f5f5", letterSpacing: "-0.02em" }}>Structural Projects</h1>
              <p style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "'Space Mono', monospace" }}>ACTIVE PROJECT SCHEDULE · LIVE DATABASE</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={fetchProjects} className="btn-hover" style={{ background: "none", border: "1px solid #2a2d35", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "#666", display: "flex", alignItems: "center" }} title="Refresh data"><RefreshIcon /></button>
            <div style={{ display: "flex", background: "#1a1d23", borderRadius: 8, border: "1px solid #2a2d35", overflow: "hidden" }}>
              {["table", "dashboard"].map(v => (
                <button key={v} onClick={() => setCurrentView(v)} style={{ padding: "7px 14px", background: currentView === v ? "#d4a053" : "transparent", color: currentView === v ? "#111" : "#888", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>{v}</button>
              ))}
            </div>
            {/* Notifications */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} style={{ background: showNotifPanel ? "#1e2028" : "none", border: "1px solid #2a2d35", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: urgentCount > 0 ? "#f59e0b" : "#666", display: "flex", alignItems: "center", gap: 6 }}>
                <BellIcon size={18} />
                {urgentCount > 0 && <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 6px", minWidth: 18, textAlign: "center", animation: "pulse 2s infinite" }}>{urgentCount}</span>}
              </button>
              {showNotifPanel && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 420, background: "#1a1d23", border: "1px solid #2a2d35", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.5)", animation: "slideDown 0.2s ease", maxHeight: "70vh", overflow: "auto", zIndex: 200 }}>
                  <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #2a2d35", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f0f0f0" }}>Deadline Alerts</h3>
                    <span style={{ fontSize: 11, color: "#666", fontFamily: "'Space Mono', monospace" }}>{notifications.length} alerts</span>
                  </div>
                  {notifications.length === 0 && <p style={{ padding: 24, textAlign: "center", color: "#555", fontSize: 13 }}>No upcoming deadlines</p>}
                  {notifications.map(n => (
                    <div key={n.id} style={{ padding: "14px 20px", borderBottom: "1px solid #1e2028", background: severityBg[n.severity], display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 4, height: 40, borderRadius: 2, background: severityColors[n.severity], flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.project}</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
                          <span style={{ color: severityColors[n.severity], fontWeight: 700 }}>{n.severity === "overdue" ? `${Math.abs(n.daysLeft)}d overdue` : `${n.daysLeft}d left`}</span>
                          {" · "}{n.type} · PM: {n.manager}
                        </div>
                      </div>
                      <button onClick={() => handleSendNotification(n)} disabled={notifSent[n.id]} className="btn-hover" style={{ padding: "6px 12px", background: notifSent[n.id] ? "#1a3a1a" : "rgba(212,160,83,0.15)", color: notifSent[n.id] ? "#4ade80" : "#d4a053", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: notifSent[n.id] ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif", flexShrink: 0, opacity: notifSent[n.id] ? 0.7 : 1 }}>
                        {notifSent[n.id] ? "✓ Sent" : <><SendIcon /> Notify</>}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { setEditProject(null); setShowAddModal(true); }} className="btn-hover" style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}><PlusIcon /> Add Project</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* ── STAT CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Active Projects", value: projects.length, accent: "#d4a053" },
            { label: "Total Fees", value: formatCurrency(totalFee), accent: "#4ade80" },
            { label: "Target Hours", value: totalTarget.toLocaleString(), accent: "#3b82f6" },
            { label: "Hours Spent", value: totalSpent.toFixed(1), accent: "#f59e0b" },
            { label: "Urgent Deadlines", value: urgentCount, accent: urgentCount > 0 ? "#ef4444" : "#4ade80" },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ background: "#12141a", border: "1px solid #1e2028", borderRadius: 12, padding: "18px 20px", transition: "all 0.2s" }}>
              <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.accent, fontFamily: "'Space Mono', monospace", letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#666" }}>
            <LoaderIcon /><p style={{ marginTop: 12, fontSize: 14 }}>Loading projects from database...</p>
          </div>
        ) : currentView === "dashboard" ? (
          <DashboardView projects={projects} notifications={notifications} rate={rate} />
        ) : (
          <>
            {/* ── RATE INPUT + FILTERS ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "14px 18px", background: "#12141a", border: "1px solid #1e2028", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#d4a053", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>Rate ($/hr)</label>
                <div style={{ position: "relative", width: 100 }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: 13, fontWeight: 600 }}>$</span>
                  <input type="number" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 100, paddingLeft: 24, textAlign: "right", fontSize: 14, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: "#d4a053", background: "#0d0f14" }} />
                </div>
              </div>
              <div style={{ width: 1, height: 28, background: "#2a2d35", flexShrink: 0 }} />
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#555" }}><SearchIcon /></span>
                <input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 36 }} />
              </div>
              <select value={filterManager} onChange={e => setFilterManager(e.target.value)} style={{ ...selectStyle, width: 160 }}>
                <option value="All">All Managers</option>
                {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...selectStyle, width: 200 }}>
                <option value="All">All Types</option>
                {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* ── TABLE ── */}
            <div style={{ borderRadius: 12, border: "1px solid #1e2028", overflow: "auto", background: "#12141a" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <SortHeader field="name" width="20%">Project Name</SortHeader>
                    <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", width: "8%", borderBottom: "2px solid #2a2d35", background: "#13151b", position: "sticky", top: 0, zIndex: 2 }}>Status</th>
                    <SortHeader field="number" width="8%">Proj #</SortHeader>
                    <SortHeader field="state" width="4%">St</SortHeader>
                    <SortHeader field="manager" width="5%">PM</SortHeader>
                    <SortHeader field="type" width="10%">Type</SortHeader>
                    <SortHeader field="kickOff" width="8%">Kick Off</SortHeader>
                    <SortHeader field="qcll" width="8%">QC / LL</SortHeader>
                    <SortHeader field="pcd" width="8%">P / CD</SortHeader>
                    <SortHeader field="fee" width="7%" align="right">Fee</SortHeader>
                    <SortHeader field="targetHours" width="7%" align="right">Target Hrs</SortHeader>
                    <SortHeader field="hoursSpent" width="6%" align="right">Spent</SortHeader>
                    <th style={{ padding: "12px 10px", fontSize: 10.5, fontWeight: 700, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid #2a2d35", background: "#13151b", position: "sticky", top: 0, zIndex: 2, width: "6%", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const pcdStatus = getDeadlineStatus(p.pcd);
                    const qcStatus = getDeadlineStatus(p.qcll);
                    const targetHrs = rate > 0 ? Math.round(p.fee / rate) : 0;
                    const progress = targetHrs > 0 ? Math.min((p.hoursSpent / targetHrs) * 100, 100) : 0;
                    const overBudget = p.hoursSpent > targetHrs;
                    const status = getProjectStatus(p);
                    const isGreyed = status.key === "hold" || status.key === "completed";
                    const rowOpacity = isGreyed ? 0.45 : 1;
                    const statusColors = { current: { bg: "rgba(34,197,94,0.1)", fg: "#4ade80" }, completed: { bg: "rgba(59,130,246,0.1)", fg: "#60a5fa" }, hold: { bg: "rgba(245,158,11,0.1)", fg: "#fbbf24" } };
                    const sc = statusColors[status.key];
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid #1a1d23", opacity: rowOpacity, transition: "opacity 0.3s", background: isGreyed ? "rgba(255,255,255,0.02)" : "transparent" }}>
                        <td style={{ padding: "11px 10px", color: "#e8e8e8", fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ background: sc.bg, color: sc.fg, padding: "3px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap" }}>{status.label}</span>
                        </td>
                        <td style={{ padding: "11px 10px", color: "#999", fontFamily: "'Space Mono', monospace", fontSize: 11.5 }}>{p.number}</td>
                        <td style={{ padding: "11px 10px", color: "#888", textAlign: "center" }}>{p.state}</td>
                        <td style={{ padding: "11px 10px" }}><span style={{ background: "rgba(212,160,83,0.12)", color: "#d4a053", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{p.manager}</span></td>
                        <td style={{ padding: "11px 10px", color: "#aaa", fontSize: 12 }}>{p.type}</td>
                        <td style={{ padding: "11px 10px", color: "#888", fontSize: 12 }}>{formatDate(p.kickOff)}</td>
                        <td style={{ padding: "11px 10px" }}><span style={statusBadge(qcStatus)}>{formatDate(p.qcll)}</span></td>
                        <td style={{ padding: "11px 10px" }}><span style={statusBadge(pcdStatus)}>{formatDate(p.pcd)}</span></td>
                        <td style={{ padding: "11px 10px", textAlign: "right", color: "#4ade80", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600 }}>{formatCurrency(p.fee)}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#1e2028", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", borderRadius: 2, background: overBudget ? "#ef4444" : progress > 90 ? "#f59e0b" : "#4ade80" }} /></div>
                            <span style={{ color: "#aaa", fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{targetHrs}</span>
                          </div>
                        </td>
                        <td style={{ padding: "6px 6px", textAlign: "right" }}>
                          <HoursInput
                            projectId={p.id}
                            value={p.hoursSpent}
                            overBudget={overBudget}
                            onSave={async (id, val) => {
                              setProjects(ps => ps.map(proj => proj.id === id ? { ...proj, hoursSpent: val } : proj));
                              const { error } = await supabase.from("projects").update({ hours_spent: val }).eq("id", id);
                              if (error) showToast("Failed to save hours: " + error.message, "error");
                            }}
                          />
                        </td>
                        <td style={{ padding: "11px 10px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                            <button onClick={() => { setEditProject(p); setShowAddModal(true); }} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 6, borderRadius: 4 }} title="Edit"><EditIcon /></button>
                            <button onClick={() => handleDelete(p.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 6, borderRadius: 4 }} title="Delete"><TrashIcon /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #2a2d35", background: "#13151b" }}>
                    <td colSpan={9} style={{ padding: "12px 10px", fontWeight: 700, color: "#999", fontSize: 12 }}>TOTALS ({filtered.length} projects)</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 800, color: "#4ade80", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{formatCurrency(filtered.reduce((s, p) => s + p.fee, 0))}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "#aaa", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{rate > 0 ? filtered.reduce((s, p) => s + Math.round(p.fee / rate), 0).toLocaleString() : "—"}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "#888", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{filtered.reduce((s, p) => s + p.hoursSpent, 0).toFixed(1)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── MODALS ── */}
      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setEditProject(null); }} title={editProject ? "Edit Project" : "Add New Project"} width={640}>
        <ProjectForm project={editProject} onSave={handleSave} onCancel={() => { setShowAddModal(false); setEditProject(null); }} saving={saving} />
      </Modal>

      <Modal open={showNotifModal} onClose={() => setShowNotifModal(false)} title="Send Notification" width={480}>
        {notifTarget && (
          <div>
            <div style={{ background: "#12141a", borderRadius: 8, padding: 16, marginBottom: 20, border: "1px solid #1e2028" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#aaa" }}>The following notification will be sent to <strong style={{ color: "#d4a053" }}>{notifTarget.manager}</strong>:</p>
              <div style={{ background: "#0d0f14", borderRadius: 6, padding: 14, border: "1px solid #1e2028", fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ color: "#f0f0f0", fontWeight: 600, marginBottom: 6 }}>⚠️ Deadline Reminder</div>
                <div style={{ color: "#ccc" }}>
                  <strong>{notifTarget.project}</strong><br />
                  {notifTarget.type} deadline: <strong style={{ color: severityColors[notifTarget.severity] }}>{formatDate(notifTarget.date)}</strong><br />
                  {notifTarget.severity === "overdue"
                    ? <span style={{ color: "#3b82f6" }}>This deadline is {Math.abs(notifTarget.daysLeft)} days overdue!</span>
                    : <span>Only <strong>{notifTarget.daysLeft} days</strong> remaining.</span>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNotifModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={confirmSendNotif} className="btn-hover" style={btnPrimary}>Send to {notifTarget.manager}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── TOAST ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
