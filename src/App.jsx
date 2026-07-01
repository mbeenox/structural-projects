import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

const PROJECT_TYPES = ["Ground up", "TFO", "Conversion", "Site Adapt", "Site Adapt - Modification", "Patio Addition", "Tenant Finish out"];
const MANAGERS = ["MJ", "EM", "SAS", "SAS/MJ", "MJ/EM"];
const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

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
  return { label: "Active", key: "active" };
}

function isArchived(p) {
  if (!p.pcd) return false;
  return daysUntil(p.pcd) < -30 && !p.holdDate;
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
const SunIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>;
const MoonIcon = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;

// ── Styles ───────────────────────────────────────────────
const inputStyle = { width: "100%", padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 8, color: "var(--text)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };
const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" };
const btnPrimary = { padding: "10px 20px", background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em", transition: "all 0.2s" };
const btnSecondary = { padding: "10px 20px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-3)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" };
const severityColors = { critical: "var(--red)", overdue: "var(--blue)", warning: "var(--amber)", info: "var(--blue)" };
const severityBg = { critical: "var(--red-soft-bg)", overdue: "var(--blue-soft-bg)", warning: "var(--amber-soft-bg)", info: "var(--blue-soft-bg)" };

function statusBadge(status) {
  const c = { overdue: { bg: "var(--blue-soft-bg)", fg: "var(--blue)" }, urgent: { bg: "var(--red-soft-bg)", fg: "var(--red-2)" }, warning: { bg: "var(--amber-soft-bg)", fg: "var(--amber-2)" }, ok: { bg: "var(--green-soft-bg)", fg: "var(--green)" } }[status] || { bg: "var(--green-soft-bg)", fg: "var(--green)" };
  return { background: c.bg, color: c.fg, padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, display: "inline-block" };
}

// ── Modal ────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--overlay)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }}>
      <div style={{ background: "var(--surface-3)", border: "1px solid var(--border-2)", borderRadius: 12, width, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid var(--border-2)" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-bright)", fontFamily: "'DM Sans', sans-serif" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 4 }}><XIcon size={20} /></button>
        </div>
        <div style={{ padding: "20px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "error" ? "#7f1d1d" : type === "success" ? "#14532d" : "#1e3a5f";
  const border = type === "error" ? "#dc2626" : type === "success" ? "#22c55e" : "var(--blue)";
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 2000, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 20px", color: "#eef2f7", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 10px 30px var(--shadow-md)", animation: "slideUp 0.3s ease", maxWidth: 380, display: "flex", alignItems: "center", gap: 10 }}>
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
  const barColors = ["var(--accent)", "var(--green)", "var(--blue)", "var(--amber)", "var(--purple)"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--text-bright)" }}>Workload by Manager</h3>
        {Object.entries(managerStats).map(([mgr, stats], i) => {
          const maxFee = Math.max(...Object.values(managerStats).map(s => s.fee));
          return (<div key={mgr} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{mgr}</span><span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>{stats.count} projects · {formatCurrency(stats.fee)}</span></div>
            <div style={{ height: 8, background: "var(--track)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(stats.fee / maxFee) * 100}%`, height: "100%", borderRadius: 4, background: barColors[i % barColors.length], transition: "width 0.6s ease" }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-faint)" }}><span>{stats.spent.toFixed(1)}h spent</span><span>{stats.target}h target</span></div>
          </div>);
        })}
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--text-bright)" }}>Projects by Type</h3>
        {Object.entries(typeStats).sort((a, b) => b[1].count - a[1].count).map(([type, stats], i) => (
          <div key={type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-row)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: barColors[i % barColors.length] }} /><span style={{ fontSize: 13, color: "var(--text-2)" }}>{type}</span></div>
            <div style={{ display: "flex", gap: 20 }}><span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace" }}>{stats.count}</span><span style={{ fontSize: 12, color: "var(--green)", fontFamily: "'Space Mono', monospace", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{formatCurrency(stats.fee)}</span></div>
          </div>
        ))}
      </div>
      <div style={{ gridColumn: "1 / -1", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--text-bright)" }}>Upcoming Deadlines</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {notifications.filter(n => n.daysLeft >= 0).slice(0, 12).map(n => (
            <div key={n.id} style={{ background: "var(--inset-deep)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid ${severityColors[n.severity] || "var(--blue)"}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.project}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{n.type} · {formatDate(n.date)} · <span style={{ color: severityColors[n.severity], fontWeight: 700 }}>{n.daysLeft}d left</span></div>
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
        background: overBudget ? "var(--red-soft-bg-strong)" : "var(--inset-deep)",
        border: overBudget ? "1px solid var(--red-soft-border)" : "1px solid var(--border)",
        borderRadius: 5, color: overBudget ? "var(--red)" : "var(--text-3)",
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
  const [sortField, setSortField] = useState("kickOff");
  const [sortDir, setSortDir] = useState("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifSent, setNotifSent] = useState({});
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifTarget, setNotifTarget] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentView, setCurrentView] = useState("table");
  const [rate, setRate] = useState(100);
  const [rateLoaded, setRateLoaded] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("sp-theme") || "light"; } catch { return "light"; }
  });

  const showToast = (message, type = "info") => setToast({ message, type });

  // ── Persist theme + keep page background in sync ──
  useEffect(() => {
    try { localStorage.setItem("sp-theme", theme); } catch {}
    document.body.style.backgroundColor = theme === "light" ? "#eef1f5" : "#0d0f14";
  }, [theme]);

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
    const { data, error } = await supabase.from("projects").select("*").order("kick_off", { ascending: false, nullsFirst: false });
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

  // ── CRUD: Delete / Archive ──
  const handleDeleteClick = (project) => {
    setDeleteTarget(project);
    setShowDeleteModal(true);
  };

  const handleArchive = async () => {
    if (!deleteTarget) return;
    // Set PCD to 31 days ago to force archiving, preserve other data
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - 31);
    const pcdStr = archiveDate.toISOString().split("T")[0];
    const { error } = await supabase.from("projects").update({ pcd: pcdStr, hold_date: null }).eq("id", deleteTarget.id);
    if (error) showToast("Archive failed: " + error.message, "error");
    else { showToast(`"${deleteTarget.name}" moved to archive`, "success"); fetchProjects(); }
    setShowDeleteModal(false);
    setDeleteTarget(null);
  };

  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("projects").delete().eq("id", deleteTarget.id);
    if (error) showToast("Delete failed: " + error.message, "error");
    else { showToast(`"${deleteTarget.name}" permanently deleted`, "success"); fetchProjects(); }
    setShowDeleteModal(false);
    setDeleteTarget(null);
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
  const applyFilters = (p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.number.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterManager !== "All" && p.manager !== filterManager) return false;
    if (filterType !== "All" && p.type !== filterType) return false;
    return true;
  };
  const applySorting = (a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  };

  const filtered = projects.filter(p => !isArchived(p) && applyFilters(p)).sort(applySorting);
  const archivedFiltered = projects.filter(p => isArchived(p) && applyFilters(p)).sort(applySorting);
  const archivedCount = projects.filter(p => isArchived(p)).length;

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const totalFee = filtered.filter(p => getProjectStatus(p).key === "active").reduce((s, p) => s + p.fee, 0);
  const totalTarget = rate > 0 ? filtered.filter(p => getProjectStatus(p).key === "active").reduce((s, p) => s + Math.round(p.fee / rate), 0) : 0;
  const totalSpent = filtered.filter(p => getProjectStatus(p).key === "active").reduce((s, p) => s + p.hoursSpent, 0);

  const activeCount = filtered.filter(p => getProjectStatus(p).key === "active").length;
  const urgentCount = filtered.filter(p => {
    if (!p.pcd || getProjectStatus(p).key !== "active") return false;
    const d = daysUntil(p.pcd);
    return d >= 0 && d <= 7;
  }).length;

  const SortHeader = ({ field, children, width, align }) => (
    <th onClick={() => handleSort(field)} style={{ padding: "12px 10px", textAlign: align || "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", width, borderBottom: "2px solid var(--border-2)", background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 2 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{children}{sortField === field && <ChevronIcon dir={sortDir === "asc" ? "down" : "up"} />}</span>
    </th>
  );

  return (
    <div className={theme === "light" ? "theme-light" : "theme-dark"} style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        /* ── THEME TOKENS ────────────────────────────────── */
        .theme-dark {
          --bg:#0d0f14; --surface:#12141a; --surface-2:#13151b; --surface-3:#1a1d23;
          --inset-deep:#0d0f14; --track:#1e2028; --track-hover:rgba(212,160,83,0.04);
          --border:#1e2028; --border-2:#2a2d35; --border-3:#333; --border-row:#1a1d23;
          --text-bright:#f0f0f0; --text:#e0e0e0; --text-2:#cccccc; --text-3:#aaaaaa;
          --text-muted:#888888; --text-faint:#666666;
          --accent:#d4a053; --accent-strong:#b8862f; --on-accent:#111111;
          --accent-soft-bg:rgba(212,160,83,0.12); --accent-soft-bg-2:rgba(212,160,83,0.15);
          --green:#4ade80; --green-soft-bg:rgba(34,197,94,0.10);
          --blue:#3b82f6; --blue-2:#60a5fa; --blue-soft-bg:rgba(59,130,246,0.12);
          --blue-soft-border:rgba(59,130,246,0.25);
          --amber:#f59e0b; --amber-2:#fbbf24; --amber-soft-bg:rgba(245,158,11,0.10);
          --red:#ef4444; --red-2:#f87171; --red-soft-bg:rgba(239,68,68,0.10);
          --red-soft-bg-strong:rgba(239,68,68,0.15);
          --red-soft-border:rgba(239,68,68,0.40); --red-soft-border-2:rgba(239,68,68,0.20);
          --purple:#a78bfa; --grey-soft-bg:rgba(107,114,128,0.15);
          --greyed-row:rgba(255,255,255,0.02); --overlay:rgba(0,0,0,0.55);
          --shadow-lg:rgba(0,0,0,0.50); --shadow-md:rgba(0,0,0,0.40); --shadow-sm:rgba(0,0,0,0.30);
        }
        .theme-light {
          --bg:#eef1f5; --surface:#ffffff; --surface-2:#f4f7fb; --surface-3:#ffffff;
          --inset-deep:#eff3f8; --track:#e3e7ee; --track-hover:rgba(30,58,95,0.06);
          --border:#e3e7ee; --border-2:#d5dbe4; --border-3:#cbd2dc; --border-row:#eceff4;
          --text-bright:#0f172a; --text:#1e293b; --text-2:#334155; --text-3:#475569;
          --text-muted:#64748b; --text-faint:#94a3b8;
          --accent:#1e3a5f; --accent-strong:#16304e; --on-accent:#ffffff;
          --accent-soft-bg:rgba(30,58,95,0.10); --accent-soft-bg-2:rgba(30,58,95,0.15);
          --green:#16a34a; --green-soft-bg:rgba(22,163,74,0.12);
          --blue:#2563eb; --blue-2:#3b82f6; --blue-soft-bg:rgba(37,99,235,0.12);
          --blue-soft-border:rgba(37,99,235,0.30);
          --amber:#d97706; --amber-2:#b45309; --amber-soft-bg:rgba(217,119,6,0.14);
          --red:#dc2626; --red-2:#ef4444; --red-soft-bg:rgba(220,38,38,0.10);
          --red-soft-bg-strong:rgba(220,38,38,0.14);
          --red-soft-border:rgba(220,38,38,0.35); --red-soft-border-2:rgba(220,38,38,0.22);
          --purple:#7c3aed; --grey-soft-bg:rgba(100,116,139,0.14);
          --greyed-row:rgba(15,23,42,0.04); --overlay:rgba(15,23,42,0.35);
          --shadow-lg:rgba(15,23,42,0.18); --shadow-md:rgba(15,23,42,0.12); --shadow-sm:rgba(15,23,42,0.08);
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: var(--surface); }
        ::-webkit-scrollbar-thumb { background: var(--border-3); border-radius: 3px; }
        input:focus, select:focus { border-color: var(--accent) !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        tr:hover td { background: var(--track-hover) !important; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px var(--shadow-sm); }
        .btn-hover:hover { opacity: 0.85; transform: translateY(-1px); }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "0 32px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, var(--accent), var(--accent-strong))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "var(--on-accent)", fontFamily: "'Space Mono', monospace" }}>SP</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text-bright)", letterSpacing: "-0.02em" }}>Structural Projects</h1>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-faint)", fontFamily: "'Space Mono', monospace" }}>ACTIVE PROJECT SCHEDULE · LIVE DATABASE</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")} className="btn-hover" style={{ background: "none", border: "1px solid var(--border-2)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center" }} title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>{theme === "light" ? <MoonIcon /> : <SunIcon />}</button>
            <button onClick={fetchProjects} className="btn-hover" style={{ background: "none", border: "1px solid var(--border-2)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "var(--text-faint)", display: "flex", alignItems: "center" }} title="Refresh data"><RefreshIcon /></button>
            <div style={{ display: "flex", background: "var(--surface-3)", borderRadius: 8, border: "1px solid var(--border-2)", overflow: "hidden" }}>
              {["table", "archive", "dashboard"].map(v => (
                <button key={v} onClick={() => setCurrentView(v)} style={{ padding: "7px 14px", background: currentView === v ? "var(--accent)" : "transparent", color: currentView === v ? "var(--on-accent)" : "var(--text-muted)", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize", display: "flex", alignItems: "center", gap: 5 }}>
                  {v}
                  {v === "archive" && archivedCount > 0 && (
                    <span style={{ background: currentView === "archive" ? "rgba(0,0,0,0.2)" : "var(--border-2)", color: currentView === "archive" ? "var(--on-accent)" : "var(--text-muted)", fontSize: 10, fontWeight: 800, borderRadius: 8, padding: "1px 6px", minWidth: 18, textAlign: "center" }}>{archivedCount}</span>
                  )}
                </button>
              ))}
            </div>
            {/* Notifications */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotifPanel(!showNotifPanel)} style={{ background: showNotifPanel ? "var(--surface-2)" : "none", border: "1px solid var(--border-2)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: urgentCount > 0 ? "var(--amber)" : "var(--text-faint)", display: "flex", alignItems: "center", gap: 6 }}>
                <BellIcon size={18} />
                {urgentCount > 0 && <span style={{ background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 6px", minWidth: 18, textAlign: "center", animation: "pulse 2s infinite" }}>{urgentCount}</span>}
              </button>
              {showNotifPanel && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 420, background: "var(--surface-3)", border: "1px solid var(--border-2)", borderRadius: 12, boxShadow: "0 20px 50px var(--shadow-lg)", animation: "slideDown 0.2s ease", maxHeight: "70vh", overflow: "auto", zIndex: 200 }}>
                  <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-bright)" }}>Deadline Alerts</h3>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'Space Mono', monospace" }}>{notifications.length} alerts</span>
                  </div>
                  {notifications.length === 0 && <p style={{ padding: 24, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No upcoming deadlines</p>}
                  {notifications.map(n => (
                    <div key={n.id} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: severityBg[n.severity], display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 4, height: 40, borderRadius: 2, background: severityColors[n.severity], flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.project}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                          <span style={{ color: severityColors[n.severity], fontWeight: 700 }}>{n.severity === "overdue" ? `${Math.abs(n.daysLeft)}d overdue` : `${n.daysLeft}d left`}</span>
                          {" · "}{n.type} · PM: {n.manager}
                        </div>
                      </div>
                      <button onClick={() => handleSendNotification(n)} disabled={notifSent[n.id]} className="btn-hover" style={{ padding: "6px 12px", background: notifSent[n.id] ? "var(--green-soft-bg)" : "var(--accent-soft-bg-2)", color: notifSent[n.id] ? "var(--green)" : "var(--accent)", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: notifSent[n.id] ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif", flexShrink: 0, opacity: notifSent[n.id] ? 0.7 : 1 }}>
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
            { label: "Active Projects", value: activeCount, accent: "var(--accent)" },
            { label: "Total Fees", value: formatCurrency(totalFee), accent: "var(--green)" },
            { label: "Target Hours", value: totalTarget.toLocaleString(), accent: "var(--blue)" },
            { label: "Hours Spent", value: totalSpent.toFixed(1), accent: "var(--amber)" },
            { label: "Urgent Deadlines", value: urgentCount, accent: urgentCount > 0 ? "var(--red)" : "var(--green)" },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", transition: "all 0.2s" }}>
              <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.accent, fontFamily: "'Space Mono', monospace", letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-faint)" }}>
            <LoaderIcon /><p style={{ marginTop: 12, fontSize: 14 }}>Loading projects from database...</p>
          </div>
        ) : currentView === "dashboard" ? (
          <DashboardView projects={projects} notifications={notifications} rate={rate} />
        ) : currentView === "archive" ? (
          <>
            {/* ── ARCHIVE FILTERS ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue-2)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans', sans-serif" }}>Archive</span>
                <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "'Space Mono', monospace" }}>Projects completed 30+ days ago</span>
              </div>
              <div style={{ width: 1, height: 28, background: "var(--border-2)", flexShrink: 0 }} />
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}><SearchIcon /></span>
                <input placeholder="Search archived projects..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 36 }} />
              </div>
              <select value={filterManager} onChange={e => setFilterManager(e.target.value)} style={{ ...selectStyle, width: 160 }}>
                <option value="All">All Managers</option>
                {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* ── ARCHIVE TABLE ── */}
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "auto", background: "var(--surface)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <SortHeader field="name" width="20%">Project Name</SortHeader>
                    <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", width: "8%", borderBottom: "2px solid var(--border-2)", background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 2 }}>Status</th>
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
                    <th style={{ padding: "12px 10px", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid var(--border-2)", background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 2, width: "6%", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedFiltered.length === 0 && (
                    <tr><td colSpan={13} style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 14 }}>No archived projects</td></tr>
                  )}
                  {archivedFiltered.map(p => {
                    const pcdStatus = getDeadlineStatus(p.pcd);
                    const qcStatus = getDeadlineStatus(p.qcll);
                    const targetHrs = rate > 0 ? Math.round(p.fee / rate) : 0;
                    const progress = targetHrs > 0 ? Math.min((p.hoursSpent / targetHrs) * 100, 100) : 0;
                    const overBudget = p.hoursSpent > targetHrs;
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--border-row)", opacity: 0.6 }}>
                        <td style={{ padding: "11px 10px", color: "var(--text)", fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ background: "var(--grey-soft-bg)", color: "var(--text-muted)", padding: "3px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap" }}>Archived</span>
                        </td>
                        <td style={{ padding: "11px 10px", color: "var(--text-3)", fontFamily: "'Space Mono', monospace", fontSize: 11.5 }}>{p.number}</td>
                        <td style={{ padding: "11px 10px", color: "var(--text-muted)", textAlign: "center" }}>{p.state}</td>
                        <td style={{ padding: "11px 10px" }}><span style={{ background: "var(--accent-soft-bg)", color: "var(--accent)", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{p.manager}</span></td>
                        <td style={{ padding: "11px 10px", color: "var(--text-3)", fontSize: 12 }}>{p.type}</td>
                        <td style={{ padding: "11px 10px", color: "var(--text-muted)", fontSize: 12 }}>{formatDate(p.kickOff)}</td>
                        <td style={{ padding: "11px 10px" }}><span style={statusBadge(qcStatus)}>{formatDate(p.qcll)}</span></td>
                        <td style={{ padding: "11px 10px" }}><span style={statusBadge(pcdStatus)}>{formatDate(p.pcd)}</span></td>
                        <td style={{ padding: "11px 10px", textAlign: "right", color: "var(--green)", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600 }}>{formatCurrency(p.fee)}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--track)", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", borderRadius: 2, background: overBudget ? "var(--red)" : progress > 90 ? "var(--amber)" : "var(--green)" }} /></div>
                            <span style={{ color: "var(--text-3)", fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{targetHrs}</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 10px", textAlign: "right", color: overBudget ? "var(--red)" : "var(--text-muted)", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: overBudget ? 800 : 400 }}>{p.hoursSpent}</td>
                        <td style={{ padding: "11px 10px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                            <button onClick={() => { setEditProject(p); setShowAddModal(true); }} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 6, borderRadius: 4 }} title="Edit"><EditIcon /></button>
                            <button onClick={() => handleDeleteClick(p)} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 6, borderRadius: 4 }} title="Delete"><TrashIcon /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border-2)", background: "var(--surface-2)" }}>
                    <td colSpan={9} style={{ padding: "12px 10px", fontWeight: 700, color: "var(--text-3)", fontSize: 12 }}>ARCHIVED ({archivedFiltered.length} projects)</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 800, color: "var(--green)", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{formatCurrency(archivedFiltered.reduce((s, p) => s + p.fee, 0))}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "var(--text-3)", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{rate > 0 ? archivedFiltered.reduce((s, p) => s + Math.round(p.fee / rate), 0).toLocaleString() : "—"}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{archivedFiltered.reduce((s, p) => s + p.hoursSpent, 0).toFixed(1)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <>
            {/* ── RATE INPUT + FILTERS ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>Rate ($/hr)</label>
                <div style={{ position: "relative", width: 100 }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", fontSize: 13, fontWeight: 600 }}>$</span>
                  <input type="number" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)} style={{ ...inputStyle, width: 100, paddingLeft: 24, textAlign: "right", fontSize: 14, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: "var(--accent)", background: "var(--inset-deep)" }} />
                </div>
              </div>
              <div style={{ width: 1, height: 28, background: "var(--border-2)", flexShrink: 0 }} />
              <div style={{ position: "relative", flex: "1 1 220px" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}><SearchIcon /></span>
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
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "auto", background: "var(--surface)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <SortHeader field="name" width="20%">Project Name</SortHeader>
                    <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", width: "8%", borderBottom: "2px solid var(--border-2)", background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 2 }}>Status</th>
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
                    <th style={{ padding: "12px 10px", fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "2px solid var(--border-2)", background: "var(--surface-2)", position: "sticky", top: 0, zIndex: 2, width: "6%", textAlign: "center" }}>Actions</th>
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
                    const statusColors = { active: { bg: "var(--green-soft-bg)", fg: "var(--green)" }, completed: { bg: "var(--blue-soft-bg)", fg: "var(--blue-2)" }, hold: { bg: "var(--amber-soft-bg)", fg: "var(--amber-2)" } };
                    const sc = statusColors[status.key];
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--border-row)", opacity: rowOpacity, transition: "opacity 0.3s", background: isGreyed ? "var(--greyed-row)" : "transparent" }}>
                        <td style={{ padding: "11px 10px", color: "var(--text)", fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: "11px 10px" }}>
                          <span style={{ background: sc.bg, color: sc.fg, padding: "3px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700, display: "inline-block", whiteSpace: "nowrap" }}>{status.label}</span>
                        </td>
                        <td style={{ padding: "11px 10px", color: "var(--text-3)", fontFamily: "'Space Mono', monospace", fontSize: 11.5 }}>{p.number}</td>
                        <td style={{ padding: "11px 10px", color: "var(--text-muted)", textAlign: "center" }}>{p.state}</td>
                        <td style={{ padding: "11px 10px" }}><span style={{ background: "var(--accent-soft-bg)", color: "var(--accent)", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{p.manager}</span></td>
                        <td style={{ padding: "11px 10px", color: "var(--text-3)", fontSize: 12 }}>{p.type}</td>
                        <td style={{ padding: "11px 10px", color: "var(--text-muted)", fontSize: 12 }}>{formatDate(p.kickOff)}</td>
                        <td style={{ padding: "11px 10px" }}><span style={statusBadge(qcStatus)}>{formatDate(p.qcll)}</span></td>
                        <td style={{ padding: "11px 10px" }}><span style={statusBadge(pcdStatus)}>{formatDate(p.pcd)}</span></td>
                        <td style={{ padding: "11px 10px", textAlign: "right", color: "var(--green)", fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600 }}>{formatCurrency(p.fee)}</td>
                        <td style={{ padding: "11px 10px", textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--track)", overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", borderRadius: 2, background: overBudget ? "var(--red)" : progress > 90 ? "var(--amber)" : "var(--green)" }} /></div>
                            <span style={{ color: "var(--text-3)", fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{targetHrs}</span>
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
                            <button onClick={() => { setEditProject(p); setShowAddModal(true); }} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 6, borderRadius: 4 }} title="Edit"><EditIcon /></button>
                            <button onClick={() => handleDeleteClick(p)} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 6, borderRadius: 4 }} title="Delete"><TrashIcon /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border-2)", background: "var(--surface-2)" }}>
                    <td colSpan={9} style={{ padding: "12px 10px", fontWeight: 700, color: "var(--text-3)", fontSize: 12 }}>TOTALS ({filtered.length} projects)</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 800, color: "var(--green)", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{formatCurrency(filtered.reduce((s, p) => s + p.fee, 0))}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "var(--text-3)", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{rate > 0 ? filtered.reduce((s, p) => s + Math.round(p.fee / rate), 0).toLocaleString() : "—"}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>{filtered.reduce((s, p) => s + p.hoursSpent, 0).toFixed(1)}</td>
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
            <div style={{ background: "var(--surface)", borderRadius: 8, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-3)" }}>The following notification will be sent to <strong style={{ color: "var(--accent)" }}>{notifTarget.manager}</strong>:</p>
              <div style={{ background: "var(--inset-deep)", borderRadius: 6, padding: 14, border: "1px solid var(--border)", fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ color: "var(--text-bright)", fontWeight: 600, marginBottom: 6 }}>⚠️ Deadline Reminder</div>
                <div style={{ color: "var(--text-2)" }}>
                  <strong>{notifTarget.project}</strong><br />
                  {notifTarget.type} deadline: <strong style={{ color: severityColors[notifTarget.severity] }}>{formatDate(notifTarget.date)}</strong><br />
                  {notifTarget.severity === "overdue"
                    ? <span style={{ color: "var(--blue)" }}>This deadline is {Math.abs(notifTarget.daysLeft)} days overdue!</span>
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

      {/* ── DELETE / ARCHIVE MODAL ── */}
      <Modal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }} title="Remove Project" width={480}>
        {deleteTarget && (
          <div>
            <div style={{ background: "var(--surface)", borderRadius: 8, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text)", fontWeight: 600 }}>{deleteTarget.name}</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 }}>
                What would you like to do with this project?
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={handleArchive} className="btn-hover" style={{ padding: "12px 20px", background: "var(--blue-soft-bg)", color: "var(--blue-2)", border: "1px solid var(--blue-soft-border)", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "left", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}>
                <span style={{ fontSize: 18 }}>📁</span>
                <div>
                  <div>Move to Archive</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginTop: 2 }}>Project data is preserved and moved to the Archive tab</div>
                </div>
              </button>
              <button onClick={handlePermanentDelete} className="btn-hover" style={{ padding: "12px 20px", background: "var(--red-soft-bg)", color: "var(--red-2)", border: "1px solid var(--red-soft-border-2)", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textAlign: "left", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}>
                <span style={{ fontSize: 18 }}>🗑️</span>
                <div>
                  <div>Delete Permanently</div>
                  <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginTop: 2 }}>This cannot be undone — the project will be removed from the database</div>
                </div>
              </button>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} style={{ ...btnSecondary, marginTop: 4, textAlign: "center" }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── TOAST ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
