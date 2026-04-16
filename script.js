/* ═══════════════════════════════════════════════
   Charanas Analyzer — script.js
   Full school exam management system
═══════════════════════════════════════════════ */

'use strict';

// ═══════════════ PLATFORM MULTI-SCHOOL ═══════════════
const PLATFORM_SCHOOLS_KEY  = 'ei_platform_schools';  // [{id,name,username,password,email,createdAt}]
const PLATFORM_CREDS_KEY    = 'ei_platform_creds';    // {username, password} — set on first run
let   platformSchools       = [];
let   currentSchoolId       = null;

function loadPlatform()  { try { platformSchools = JSON.parse(localStorage.getItem(PLATFORM_SCHOOLS_KEY)) || []; } catch { platformSchools = []; } }
function savePlatform()  { localStorage.setItem(PLATFORM_SCHOOLS_KEY, JSON.stringify(platformSchools)); }

function getPlatformCreds() {
  try { return JSON.parse(localStorage.getItem(PLATFORM_CREDS_KEY)) || null; } catch { return null; }
}
function setPlatformCreds(u, p) {
  localStorage.setItem(PLATFORM_CREDS_KEY, JSON.stringify({ username: u, password: p }));
}

function schoolPrefix() { return currentSchoolId ? currentSchoolId + '_' : ''; }

// ═══════════════ STORAGE ═══════════════
const K = {
  get students()   { return schoolPrefix() + 'ei_students';  },
  get subjects()   { return schoolPrefix() + 'ei_subjects';  },
  get teachers()   { return schoolPrefix() + 'ei_teachers';  },
  get classes()    { return schoolPrefix() + 'ei_classes';   },
  get streams()    { return schoolPrefix() + 'ei_streams';   },
  get exams()      { return schoolPrefix() + 'ei_exams';     },
  get marks()      { return schoolPrefix() + 'ei_marks';     },
  get settings()   { return schoolPrefix() + 'ei_settings';  },
  get admins()     { return schoolPrefix() + 'ei_admins';    },
  get msgLog()     { return schoolPrefix() + 'ei_msglog';    },
  get dark()       { return schoolPrefix() + 'ei_dark';      },
  get smsCredits() { return schoolPrefix() + 'ei_sms';       },
};
const load = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid  = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);

// ═══════════════ APP STATE ═══════════════
let students=[], subjects=[], teachers=[], classes=[], streams=[];
let exams=[], marks=[], settings={}, admins=[], msgLog=[];
let currentUser = null;   // { username, role, name, canAnalyse, canReport, canMerit }

// ── Sort state for each list table ──
const sortState = {
  students:  { col: 'name',  dir: 'asc' },
  teachers:  { col: 'name',  dir: 'asc' },
  subjects:  { col: 'name',  dir: 'asc' },
  classes:   { col: 'name',  dir: 'asc' },
  streams:   { col: 'name',  dir: 'asc' },
};
function sortList(arr, col, dir) {
  return [...arr].sort((a, b) => {
    let va = a[col] ?? '';
    let vb = b[col] ?? '';
    // numeric detection
    if (!isNaN(parseFloat(va)) && !isNaN(parseFloat(vb))) { va = parseFloat(va); vb = parseFloat(vb); }
    else { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
    if (va < vb) return dir === 'asc' ? -1 :  1;
    if (va > vb) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}
function setSortState(table, col) {
  if (sortState[table].col === col) {
    sortState[table].dir = sortState[table].dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState[table].col = col;
    sortState[table].dir = 'asc';
  }
}
function sortIcon(table, col) {
  if (sortState[table].col !== col) return '<span style="color:var(--muted);font-size:.65rem;margin-left:2px">⇅</span>';
  return sortState[table].dir === 'asc'
    ? '<span style="color:var(--primary);font-size:.7rem;margin-left:2px">▲</span>'
    : '<span style="color:var(--primary);font-size:.7rem;margin-left:2px">▼</span>';
}
function thSort(table, col, label) {
  return `<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="onSortClick('${table}','${col}')">${label}${sortIcon(table,col)}</th>`;
}
function onSortClick(table, col) {
  setSortState(table, col);
  if      (table === 'students') renderStudents();
  else if (table === 'teachers') renderTeachers();
  else if (table === 'subjects') renderSubjects();
  else if (table === 'classes')  renderClasses();
  else if (table === 'streams')  renderStreams();
}
let smsCredits = 0;

// ═══════════════ GRADING ═══════════════
function getGrade(marks, maxMarks=100) {
  return getGradeFromSystem(marks, maxMarks);
}
function getMeanGrade(mean) {
  return getMeanGradeFromSystem(mean);
}
function gradeTag(g) { return `<span class="badge ${g.cls}">${g.grade}</span>`; }

// ═══════════════ TEACHER INITIALS ═══════════════
function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').filter(Boolean).map(w=>w[0].toUpperCase()).slice(0,2).join('');
}
function teacherInitialsTag(teacher) {
  if (!teacher) return '<span class="tch-init tch-none">—</span>';
  const ini = getInitials(teacher.name);
  const colors = ['b-blue','b-teal','b-green','b-amber','b-purple','b-coral'];
  const idx = teacher.name.charCodeAt(0) % colors.length;
  return `<span class="tch-init badge ${colors[idx]}" title="${teacher.name}">${ini}</span>`;
}

// ═══════════════ AUTO COMMENTS ═══════════════
function generateCTComment(mean, grade, gender, name, rank, total) {
  const firstName = name.split(' ')[1] || name.split(' ')[0];
  const pronoun = gender==='F' ? 'She' : 'He';
  if (grade === 'EE1') return `${firstName} has delivered an outstanding performance this term. ${pronoun} demonstrates exceptional dedication and intellectual ability.`;
  if (grade === 'EE2') return `${firstName} has performed excellently, showing strong command across all subjects. ${pronoun} is consistently focused and hardworking.`;
  if (grade === 'ME1') return `${firstName} has shown very good performance this term. ${pronoun} demonstrates a solid understanding of the curriculum.`;
  if (grade === 'ME2') return `${firstName} has shown good performance this term. With continued effort, ${firstName.toLowerCase()} can achieve even better results.`;
  if (grade === 'AE1') return `${firstName} has shown average performance. ${pronoun} should dedicate more time to revision and seek help where needed.`;
  if (grade === 'AE2') return `${firstName}'s performance is fair. ${pronoun} needs to improve study habits and actively engage in class activities.`;
  return `${firstName} needs significant improvement. ${pronoun} should work closely with teachers and not give up — consistent effort leads to better outcomes.`;
}
function generatePrincipalComment(mean, grade, rank, total) {
  if (grade === 'EE1' || grade === 'EE2') return `A commendable performance. Keep up the excellent work and continue to aim for the highest standards.`;
  if (grade === 'ME1' || grade === 'ME2') return `A satisfactory performance. The student shows good potential and is encouraged to put in more effort next term.`;
  if (grade === 'AE1') return `The student must work harder. Regular attendance, revision, and interaction with teachers will yield better results.`;
  return `The student's performance is below expectation. Parents/guardians are advised to support the student closely. We remain committed to their academic growth.`;
}

// ═══════════════ GRADING SYSTEMS ═══════════════
let gradingSystems = [];
const K_GS = 'ei_gradingsystems';
const DEFAULT_GS_ID = 'default_cbc';

function loadGradingSystems() {
  gradingSystems = (() => { try { return JSON.parse(localStorage.getItem(K_GS)) || []; } catch { return []; } })();
  if (!gradingSystems.length) {
    gradingSystems = [{
      id: DEFAULT_GS_ID, name: 'CBC Standard (Default)', isDefault: true,
      bands: [
        { min:90, max:100, grade:'EE1', points:8, label:'Outstanding',    cls:'b-green'  },
        { min:80, max:89,  grade:'EE2', points:7, label:'Excellent',      cls:'b-teal'   },
        { min:65, max:79,  grade:'ME1', points:6, label:'Very Good',      cls:'b-blue'   },
        { min:50, max:64,  grade:'ME2', points:5, label:'Good',           cls:'b-lblue'  },
        { min:35, max:49,  grade:'AE1', points:4, label:'Average',        cls:'b-amber'  },
        { min:25, max:34,  grade:'AE2', points:3, label:'Fair',           cls:'b-orange' },
        { min:13, max:24,  grade:'BE1', points:2, label:'Needs Attention', cls:'b-red'   },
        { min:0,  max:12,  grade:'BE2', points:1, label:'Needs Attention', cls:'b-dkred' },
      ]
    }];
    localStorage.setItem(K_GS, JSON.stringify(gradingSystems));
  }
}

function getActiveGradingSystemId() {
  return localStorage.getItem('ei_active_gs') || DEFAULT_GS_ID;
}
function setActiveGradingSystem(id) {
  localStorage.setItem('ei_active_gs', id);
}
function getActiveGradingSystem() {
  const id = getActiveGradingSystemId();
  return gradingSystems.find(g=>g.id===id) || gradingSystems[0];
}
function getGradeFromSystem(marks, maxMarks=100, gs=null) {
  if (!gs) gs = getActiveGradingSystem();
  const pct = (marks / maxMarks) * 100;
  for (const b of gs.bands) {
    if (pct >= b.min && pct <= b.max) return { grade:b.grade, points:b.points, label:b.label, cls:b.cls };
  }
  return gs.bands[gs.bands.length-1];
}
function getMeanGradeFromSystem(mean, gs=null) {
  if (!gs) gs = getActiveGradingSystem();
  for (const b of gs.bands) {
    if (mean >= b.min/10 && mean <= b.max/10+0.09) return { grade:b.grade, label:b.label, cls:b.cls };
  }
  // fallback: use points scale
  if (mean >= 7.5) return { grade:'EE1', label:'Outstanding', cls:'b-green' };
  if (mean >= 6.5) return { grade:'EE2', label:'Excellent', cls:'b-teal' };
  if (mean >= 5.5) return { grade:'ME1', label:'Very Good', cls:'b-blue' };
  if (mean >= 4.5) return { grade:'ME2', label:'Good', cls:'b-lblue' };
  if (mean >= 3.5) return { grade:'AE1', label:'Average', cls:'b-amber' };
  if (mean >= 2.5) return { grade:'AE2', label:'Fair', cls:'b-orange' };
  if (mean >= 1.5) return { grade:'BE1', label:'Needs Attention', cls:'b-red' };
  return { grade:'BE2', label:'Needs Attention', cls:'b-dkred' };
}
function renderGradingSystemsTab() {
  const gs = getActiveGradingSystemId();
  const list = document.getElementById('gsSystemList');
  if (!list) return;
  list.innerHTML = gradingSystems.map(s=>`
    <div class="gs-item ${s.id===gs?'gs-active':''}">
      <div class="gs-item-info">
        <strong>${s.name}</strong>
        ${s.isDefault?'<span class="badge b-teal" style="font-size:.65rem">Built-in</span>':''}
        ${s.id===gs?'<span class="badge b-green" style="font-size:.65rem">Active</span>':''}
      </div>
      <div class="gs-item-btns">
        ${s.id!==gs?`<button class="btn btn-sm btn-outline" onclick="activateGS('${s.id}')">Set Active</button>`:''}
        <button class="btn btn-sm btn-outline" onclick="editGS('${s.id}')">✏️ Edit</button>
        ${!s.isDefault?`<button class="btn btn-sm btn-danger-sm" onclick="deleteGS('${s.id}')">Delete</button>`:''}
      </div>
    </div>`).join('') || '<p style="color:var(--muted)">No grading systems.</p>';
}
function activateGS(id) {
  setActiveGradingSystem(id);
  renderGradingSystemsTab();
  showToast('Grading system changed ✓','success');
}
function deleteGS(id) {
  if (!confirm('Delete this grading system?')) return;
  gradingSystems = gradingSystems.filter(g=>g.id!==id);
  localStorage.setItem(K_GS, JSON.stringify(gradingSystems));
  if (getActiveGradingSystemId()===id) setActiveGradingSystem(DEFAULT_GS_ID);
  renderGradingSystemsTab();
  showToast('Grading system deleted','info');
}
function saveNewGradingSystem() {
  const name = document.getElementById('gsNewName')?.value.trim();
  if (!name) { showToast('Enter a name for the grading system','error'); return; }
  const rows = document.querySelectorAll('.gs-band-row');
  const bands = [];
  let valid = true;
  rows.forEach(row => {
    const min = parseInt(row.querySelector('.gs-min').value);
    const max = parseInt(row.querySelector('.gs-max').value);
    const grade = row.querySelector('.gs-grade').value.trim();
    const points = parseFloat(row.querySelector('.gs-pts').value);
    const label = row.querySelector('.gs-lbl').value.trim();
    if (!grade || isNaN(min) || isNaN(max) || isNaN(points)) { valid=false; return; }
    const clsMap = { EE1:'b-green',EE2:'b-teal',ME1:'b-blue',ME2:'b-lblue',AE1:'b-amber',AE2:'b-orange',BE1:'b-red',BE2:'b-dkred' };
    bands.push({ min, max, grade, points, label, cls: clsMap[grade]||'b-blue' });
  });
  if (!valid || !bands.length) { showToast('Fill all band rows correctly','error'); return; }
  bands.sort((a,b)=>b.min-a.min);
  gradingSystems.push({ id:'gs_'+Date.now(), name, isDefault:false, bands });
  localStorage.setItem(K_GS, JSON.stringify(gradingSystems));
  renderGradingSystemsTab();
  showToast('New grading system added ✓','success');
  document.getElementById('gsNewName').value='';
}
function addGSBandRow() {
  const tbody = document.getElementById('gsBandsBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'gs-band-row';
  tr.innerHTML = `
    <td><input type="number" class="gs-min" placeholder="0" min="0" max="100" style="width:60px"/></td>
    <td><input type="number" class="gs-max" placeholder="100" min="0" max="100" style="width:60px"/></td>
    <td><input type="text" class="gs-grade" placeholder="EE1" maxlength="4" style="width:60px"/></td>
    <td><input type="number" class="gs-pts" placeholder="8" min="0" max="10" step="0.5" style="width:60px"/></td>
    <td><input type="text" class="gs-lbl" placeholder="Outstanding" style="width:120px"/></td>
    <td><button type="button" class="icb dl" onclick="this.closest('tr').remove()">🗑</button></td>`;
  tbody.appendChild(tr);
}


// ═══════════════ PORTAL NAVIGATION ═══════════════
function showDualPortal() {
  ['platformLogin','schoolSelector','loginScreen','app'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('dualPortal').style.display = 'flex';
}
function showPlatformLogin() {
  document.getElementById('dualPortal').style.display = 'none';
  document.getElementById('platformLogin').style.display = 'flex';
  const creds = getPlatformCreds();
  const plTitle    = document.getElementById('plTitle');
  const plSubtitle = document.getElementById('plSubtitle');
  const plBtn      = document.getElementById('plBtn');
  const note       = document.getElementById('plFirstTimeNote');
  if (!creds) {
    if (plTitle)    plTitle.textContent    = 'Set Up Platform Account';
    if (plSubtitle) plSubtitle.textContent = 'Create your master admin credentials';
    if (plBtn)      plBtn.textContent      = 'Create Account & Continue →';
    if (note)       note.style.display     = '';
  } else {
    if (plTitle)    plTitle.textContent    = 'Platform Administration';
    if (plSubtitle) plSubtitle.textContent = 'Sign in to manage school accounts';
    if (plBtn)      plBtn.textContent      = 'Sign In →';
    if (note)       note.style.display     = 'none';
  }
}

function resetPlatformAccount() {
  if (!confirm('This will DELETE your platform admin credentials.\n\nYour school data will NOT be lost.\n\nProceed?')) return;
  localStorage.removeItem(PLATFORM_CREDS_KEY);
  document.getElementById('plUser').value = '';
  document.getElementById('plPass').value = '';
  document.getElementById('plErr').style.display = 'none';
  showToast('Platform account reset. Set new credentials below.', 'info');
  showPlatformLogin(); // re-render with first-time labels
}
function showSchoolDirectLogin() {
  // Go straight to school login without showing school list
  ['dualPortal','platformLogin','schoolSelector','app'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('lUser').value = '';
  document.getElementById('lPass').value = '';
  document.getElementById('loginErr').style.display = 'none';
  document.getElementById('schoolLoginLabel').textContent = 'School Login';
  // Flag that we are in direct-login mode (no pre-selected school)
  currentSchoolId = null;
  document.getElementById('loginScreen').style.display = 'flex';
}

// ═══════════════ AUTH ═══════════════
// ── Platform Login ──
function doPlatformLogin() {
  const u = document.getElementById('plUser').value.trim();
  const p = document.getElementById('plPass').value;
  document.getElementById('plErr').style.display = 'none';
  const creds = getPlatformCreds();

  // First-ever run: no creds saved yet — show setup screen
  if (!creds) {
    if (!u || !p) { document.getElementById('plErr').textContent = '❌ Enter a username and password to set up your platform account.'; document.getElementById('plErr').style.display = 'block'; return; }
    if (p.length < 6) { document.getElementById('plErr').textContent = '❌ Password must be at least 6 characters.'; document.getElementById('plErr').style.display = 'block'; return; }
    setPlatformCreds(u, p);
    showToast('Platform account created ✓', 'success');
    showSchoolSelector(true);
    return;
  }
  if (u === creds.username && p === creds.password) {
    showSchoolSelector(true);
  } else {
    document.getElementById('plErr').textContent = '❌ Invalid platform credentials.';
    document.getElementById('plErr').style.display = 'block';
  }
}

function renderPlatformSummary() {
  const kpiRow   = document.getElementById('platformKpiRow');
  const tbody    = document.getElementById('platformSchoolTableBody');
  const breakdown= document.getElementById('platformExamBreakdown');
  if (!kpiRow || !tbody) return;

  const schools  = platformSchools;
  let totalStudents=0, totalExams=0, totalMarksCount=0, totalMarksSum=0;

  const schoolStats = schools.map(s => {
    const prefix = s.id + '_';
    const getLS  = key => { try { return JSON.parse(localStorage.getItem(prefix+key)) || []; } catch { return []; } };
    const students = getLS('ei_students');
    const exams    = getLS('ei_exams');
    const subjects = getLS('ei_subjects');
    const marks    = getLS('ei_marks');

    // Compute average score across all marks
    let sum=0, cnt=0;
    marks.forEach(m => { if (typeof m.score === 'number') { sum+=m.score; cnt++; } });
    const avg = cnt ? (sum/cnt) : null;

    // Find top exam by mark count
    const examMarkCount = {};
    marks.forEach(m => { if (m.examId) examMarkCount[m.examId] = (examMarkCount[m.examId]||0)+1; });
    let topExam = null;
    if (exams.length) {
      const sorted = [...exams].sort((a,b) => (examMarkCount[b.id]||0)-(examMarkCount[a.id]||0));
      topExam = sorted[0];
    }

    totalStudents += students.length;
    totalExams    += exams.length;
    if (cnt) { totalMarksSum += sum; totalMarksCount += cnt; }

    return { school:s, students, exams, subjects, marks, avg, topExam, cnt };
  });

  const overallAvg = totalMarksCount ? (totalMarksSum/totalMarksCount) : null;

  // KPI cards
  const kpis = [
    { icon:'🏫', label:'Schools',  value: schools.length, color:'#3b82f6' },
    { icon:'👨‍🎓', label:'Students', value: totalStudents.toLocaleString(), color:'#10b981' },
    { icon:'📝', label:'Exams',    value: totalExams.toLocaleString(), color:'#f59e0b' },
    { icon:'📈', label:'Avg Score',value: overallAvg !== null ? overallAvg.toFixed(1)+'%' : '—', color:'#8b5cf6' },
  ];
  kpiRow.innerHTML = kpis.map(k => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.85rem 1rem;display:flex;align-items:center;gap:.75rem">
      <div style="font-size:1.4rem">${k.icon}</div>
      <div>
        <div style="font-size:1.25rem;font-weight:800;color:${k.color}">${k.value}</div>
        <div style="font-size:.72rem;color:#64748b;font-weight:500">${k.label}</div>
      </div>
    </div>`).join('');

  // Table rows
  if (!schools.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:1.5rem">No schools yet</td></tr>';
  } else {
    tbody.innerHTML = schoolStats.map((st,i) => {
      const avgTxt = st.avg !== null ? st.avg.toFixed(1)+'%' : '—';
      const avgColor = st.avg===null?'#94a3b8':st.avg>=60?'#10b981':st.avg>=40?'#f59e0b':'#ef4444';
      const joined = st.school.createdAt ? new Date(st.school.createdAt).toLocaleDateString() : '—';
      const topExamName = st.topExam ? (st.topExam.name||'Exam '+(i+1)) : '—';
      return `<tr style="border-top:1px solid #f1f5f9;${i%2?'background:#fafafa':''}">
        <td style="padding:.6rem 1rem;font-weight:600;color:#0f172a">${st.school.name}<br><span style="font-size:.7rem;color:#94a3b8;font-weight:400">${st.school.username}</span></td>
        <td style="padding:.6rem .75rem;text-align:center;font-weight:700;color:#3b82f6">${st.students.length}</td>
        <td style="padding:.6rem .75rem;text-align:center;font-weight:700;color:#f59e0b">${st.exams.length}</td>
        <td style="padding:.6rem .75rem;text-align:center;color:#475569">${st.subjects.length}</td>
        <td style="padding:.6rem .75rem;text-align:center;font-weight:700;color:${avgColor}">${avgTxt}</td>
        <td style="padding:.6rem .75rem;text-align:center;font-size:.75rem;color:#475569;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${topExamName}</td>
        <td style="padding:.6rem 1rem;text-align:center;font-size:.74rem;color:#94a3b8">${joined}</td>
      </tr>`;
    }).join('');
  }

  // Exam breakdown cards
  if (schools.length) {
    breakdown.innerHTML = '<div style="font-size:.85rem;font-weight:700;color:#0f172a;margin-bottom:.75rem">📋 Exam Breakdown by School</div>' +
      schoolStats.map(st => {
        if (!st.exams.length) return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:.75rem 1rem;margin-bottom:.75rem;font-size:.8rem;color:#94a3b8"><strong style="color:#475569">${st.school.name}</strong> — No exams yet</div>`;
        const rows = st.exams.map(ex => {
          const exMarks = st.marks.filter(m=>m.examId===ex.id);
          const exStudents = new Set(exMarks.map(m=>m.studentId)).size;
          let s=0,c=0; exMarks.forEach(m=>{ if(typeof m.score==='number'){s+=m.score;c++;} });
          const avg = c ? (s/c).toFixed(1)+'%' : '—';
          const avgColor = c===0?'#94a3b8':s/c>=60?'#10b981':s/c>=40?'#f59e0b':'#ef4444';
          return `<tr style="border-top:1px solid #f8fafc">
            <td style="padding:.4rem .75rem;font-size:.78rem;color:#0f172a">${ex.name||'Unnamed Exam'}</td>
            <td style="padding:.4rem .75rem;text-align:center;font-size:.78rem;color:#3b82f6;font-weight:600">${exStudents}</td>
            <td style="padding:.4rem .75rem;text-align:center;font-size:.78rem;font-weight:700;color:${avgColor}">${avg}</td>
          </tr>`;
        }).join('');
        return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:.75rem">
          <div style="padding:.6rem 1rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:.8rem;font-weight:700;color:#0f172a">🏫 ${st.school.name} <span style="font-weight:400;color:#94a3b8">(${st.exams.length} exam${st.exams.length!==1?'s':''})</span></div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f8fafc"><th style="padding:.4rem .75rem;text-align:left;font-size:.74rem;color:#64748b;font-weight:600">Exam</th><th style="padding:.4rem .75rem;text-align:center;font-size:.74rem;color:#64748b;font-weight:600">Students</th><th style="padding:.4rem .75rem;text-align:center;font-size:.74rem;color:#64748b;font-weight:600">Avg Score</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      }).join('');
  } else {
    breakdown.innerHTML = '';
  }
}

function showSchoolSelector(isPlatformAdmin) {
  loadPlatform();
  ['dualPortal','platformLogin','loginScreen','app'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const sel = document.getElementById('schoolSelector');
  sel.style.display = 'flex';
  sel.dataset.isPlatformAdmin = isPlatformAdmin ? '1' : '0';

  const grid = document.getElementById('schoolGrid');
  if (!platformSchools.length) {
    grid.innerHTML = isPlatformAdmin
      ? '<div style="color:var(--muted);text-align:center;padding:2rem;grid-column:1/-1">No school accounts yet. Create one below.</div>'
      : '<div style="color:var(--muted);text-align:center;padding:2rem;grid-column:1/-1">No schools registered yet. Contact your platform admin.</div>';
  } else {
    grid.innerHTML = platformSchools.map(s => `
      <div class="school-card" onclick="enterSchool('${s.id}')">
        <div class="sc-avatar">${s.name.charAt(0).toUpperCase()}</div>
        <div class="sc-info">
          <div class="sc-name">${s.name}</div>
          <div class="sc-meta">${s.username}</div>
          ${s.email ? '<div class="sc-meta">' + s.email + '</div>' : ''}
        </div>
        ${isPlatformAdmin ? `<button class="sc-del" onclick="event.stopPropagation();deleteSchoolAccount('${s.id}')" title="Delete school">🗑️</button>` : ''}
      </div>`).join('');
  }

  document.getElementById('addSchoolPanel').style.display   = isPlatformAdmin ? '' : 'none';
  document.getElementById('selectorBackBtn').style.display  = ''; // always show back btn

  // Show platform summary for admin
  const summaryPanel = document.getElementById('platformSummaryPanel');
  if (summaryPanel) {
    summaryPanel.style.display = isPlatformAdmin ? '' : 'none';
    if (isPlatformAdmin) renderPlatformSummary();
  }
}

function enterSchool(schoolId) {
  loadPlatform();
  const school = platformSchools.find(s => s.id === schoolId);
  if (!school) return;
  loadSchoolContext(school);

  // Render all UI
  renderDashboard(); populateAllDropdowns();
  renderStudents(); renderTeachers(); renderSubjects();
  renderClasses(); renderStreams(); renderExamList();
  populateExamDropdowns(); renderMsgLog();
  renderAdminList(); loadSettings();
  populateGSDropdowns(); renderGradingSystemsTab();
  setExamCategory('regular'); hookReportFeeAutoFill();
  renderExamSubjectCheckboxes([]);
  const smsCEl = document.getElementById('smsCredits'); if (smsCEl) smsCEl.textContent = smsCredits;

  document.getElementById('schoolSelector').style.display = 'none';
  document.getElementById('loginScreen').style.display    = 'flex';
  document.getElementById('schoolLoginLabel').textContent = school.name;
}

function backToSchoolSelector() {
  currentUser     = null;
  currentSchoolId = null;
  ['app','loginScreen','platformLogin','schoolSelector'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
  document.getElementById('lUser').value = '';
  document.getElementById('lPass').value = '';
  showDualPortal();
}

function addSchoolAccount() {
  const name  = document.getElementById('psName').value.trim();
  const user  = document.getElementById('psUser').value.trim();
  const pass  = document.getElementById('psPass').value;
  const email = document.getElementById('psEmail').value.trim();
  if (!name||!user||!pass) { showToast('Name, username and password required','error'); return; }
  loadPlatform();
  if (platformSchools.find(s=>s.username===user)) { showToast('Username already taken','error'); return; }
  platformSchools.push({ id:'sch_'+uid(), name, username:user, password:pass, email, createdAt:new Date().toISOString() });
  savePlatform();
  ['psName','psUser','psPass','psEmail'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  showToast('School account created ✓','success');
  showSchoolSelector(true);
}

function deleteSchoolAccount(id) {
  if (!confirm('Delete this school? ALL its data will be permanently removed. This cannot be undone.')) return;
  loadPlatform();
  // Wipe all school-scoped localStorage keys
  Object.keys(localStorage).filter(k=>k.startsWith(id+'_')).forEach(k=>localStorage.removeItem(k));
  platformSchools = platformSchools.filter(s=>s.id!==id);
  savePlatform();
  showToast('School deleted','info');
  showSchoolSelector(true);
}

// ── School Login ──
function loadSchoolContext(school) {
  currentSchoolId = school.id;
  students = load(K.students); subjects = load(K.subjects);
  teachers = load(K.teachers); classes  = load(K.classes);
  streams  = load(K.streams);  exams    = load(K.exams);
  marks    = load(K.marks);    settings = load(K.settings)[0] || defaultSettings();
  admins   = load(K.admins);   msgLog   = load(K.msgLog);
  smsCredits = parseInt(localStorage.getItem(K.smsCredits) || '0');
  loadFees(); loadStreamAssignments(); loadGradingSystems(); loadTermlyPapers();
  if (!settings.schoolName) { settings.schoolName = school.name; save(K.settings,[settings]); }
  seedData();
}

function doLogin() {
  const u = document.getElementById('lUser').value.trim();
  const p = document.getElementById('lPass').value;
  document.getElementById('loginErr').style.display = 'none';

  loadPlatform();

  // If a school was pre-selected via enterSchool(), only check that school.
  // If coming from showSchoolDirectLogin() (no preselection), check all schools.
  const savedSchoolId = currentSchoolId;
  const targetSchools = savedSchoolId
    ? platformSchools.filter(s => s.id === savedSchoolId)
    : platformSchools;

  for (const school of targetSchools) {
    // 1. Check school's own platform credentials (school admin login)
    if (school.username === u && school.password === p) {
      loadSchoolContext(school);
      currentUser = {
        username: school.username,
        role: 'admin',
        name: school.name,
        canAnalyse: true, canReport: true, canMerit: true
      };
      finishLogin(school);
      return;
    }

    // 2. Load this school's data so we can check its admins/teachers
    loadSchoolContext(school);

    // 3. Built-in superadmin (shown in Admin Accounts as "Built-in")
    if (u === 'superadmin' && p === 'super123') {
      currentUser = {
        id: 'builtin',
        name: 'Super Admin',
        username: 'superadmin',
        role: 'superadmin',
        builtin: true,
        canAnalyse: true, canReport: true, canMerit: true
      };
      finishLogin(school);
      return;
    }

    // 4. Check admins registered inside this school
    const admin = admins.find(a => a.username === u && a.password === p);
    if (admin) {
      currentUser = { ...admin, canAnalyse:true, canReport:true, canMerit:true };
      finishLogin(school);
      return;
    }

    // 5. Check teachers registered inside this school
    const teacher = teachers.find(t => t.username === u && t.password === p);
    if (teacher) {
      currentUser = { username:teacher.username, role:'teacher', name:teacher.name, teacherId:teacher.id,
        canAnalyse:teacher.canAnalyse, canReport:teacher.canReport, canMerit:teacher.canMerit };
      finishLogin(school);
      return;
    }

    // Not matched — restore school context and try next school
    currentSchoolId = savedSchoolId;
  }

  document.getElementById('loginErr').style.display = 'block';
}

function saveSession() {
  try {
    sessionStorage.setItem('ei_session_user',     JSON.stringify(currentUser));
    sessionStorage.setItem('ei_session_school_id', currentSchoolId || '');
  } catch(e) {}
}
function clearSession() {
  try { sessionStorage.removeItem('ei_session_user'); sessionStorage.removeItem('ei_session_school_id'); } catch(e) {}
}

function finishLogin(school) {
  renderDashboard(); populateAllDropdowns();
  renderStudents(); renderTeachers(); renderSubjects();
  renderClasses(); renderStreams(); renderExamList();
  populateExamDropdowns(); renderMsgLog();
  renderAdminList(); loadSettings();
  populateGSDropdowns(); renderGradingSystemsTab();
  setExamCategory('regular'); hookReportFeeAutoFill();
  renderExamSubjectCheckboxes([]);
  const smsCEl = document.getElementById('smsCredits'); if (smsCEl) smsCEl.textContent = smsCredits;
  document.getElementById('loginScreen').style.display = 'none';
  saveSession();
  launchApp();
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const pl = document.getElementById('platformLogin');
  const ls = document.getElementById('loginScreen');
  if (pl && pl.style.display !== 'none') doPlatformLogin();
  else if (ls && ls.style.display !== 'none') doLogin();
});
function doLogout() {
  currentUser = null;
  currentSchoolId = null;
  clearSession();
  document.getElementById('app').style.display    = 'none';
  document.getElementById('lUser').value = '';
  document.getElementById('lPass').value = '';
  showDualPortal();
}
function togglePw() {
  const f = document.getElementById('lPass');
  f.type = f.type === 'password' ? 'text' : 'password';
}
function launchApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('tbUser').textContent = '👤 ' + currentUser.name;

  // Role-based: hide analyse if no rights (full check done in applyRoleBasedUI)
  const anBtn = document.getElementById('tbAnalyse');
  if (anBtn) {
    const isTeacherRole = currentUser.role === 'teacher';
    const globalRestrictAn = isTeacherRole && !!settings.restrictTeacherAnalytics;
    anBtn.style.display = (!isTeacherRole || (!globalRestrictAn && (currentUser.canAnalyse || currentUserIsClassTeacher()))) ? '' : 'none';
  }

  // Settings: visible to all (admins see full settings; teachers see only their prefs)
  const settingsLink = document.querySelector('[data-s="settings"]');
  if (settingsLink) settingsLink.style.display = '';

  // Apply teacher-specific UI restrictions
  applyRoleBasedUI();

  // Exam Builder: visible to admins, principals and teachers (all roles)
  const ebLink = document.getElementById('examBuilderNavLink');
  if (ebLink) ebLink.style.display = '';

  if (localStorage.getItem(K.dark) === '1') applyDark(true);
  // Show school management card in settings for superadmin/admin
  const msc = document.getElementById('manageSchoolsCard');
  if (msc) {
    const isAdmin = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin');
    msc.style.display = isAdmin ? '' : 'none';
    if (isAdmin) renderSettingsSchoolList();
  }
  go('dashboard', document.querySelector('[data-s="dashboard"]'));
}
function initApp() {
  initLang();
  if (localStorage.getItem('ei_dark') === '1') applyDark(true);

  // ── Restore session after refresh / back navigation ──
  try {
    const savedUser     = JSON.parse(sessionStorage.getItem('ei_session_user') || 'null');
    const savedSchoolId = sessionStorage.getItem('ei_session_school_id') || null;
    if (savedUser && savedSchoolId) {
      currentUser     = savedUser;
      currentSchoolId = savedSchoolId;
      loadPlatform();
      const school = platformSchools.find(s => s.id === savedSchoolId);
      if (school) {
        loadSchoolContext(school);
        renderDashboard(); populateAllDropdowns();
        renderStudents(); renderTeachers(); renderSubjects();
        renderClasses(); renderStreams(); renderExamList();
        populateExamDropdowns(); renderMsgLog();
        renderAdminList(); loadSettings();
        populateGSDropdowns(); renderGradingSystemsTab();
        setExamCategory('regular'); hookReportFeeAutoFill();
        renderExamSubjectCheckboxes([]);
        const smsCEl = document.getElementById('smsCredits'); if (smsCEl) smsCEl.textContent = smsCredits;
        launchApp();
        return;
      }
    }
  } catch(e) { /* fall through to login */ }

  // No valid session — show portal
  showDualPortal();
}
function defaultSettings() {
  return { schoolName:'', address:'', phone:'', email:'', term:'Term 1', year:'2025',
    restrictTeacherAnalytics: false, restrictTeacherFees: false, restrictTeacherList: false };
}

// ═══════════════ SEED DATA ═══════════════
function seedData() {
  if (!classes.length) {
    classes = [{ id:'cls1', name:'Grade 9', level:'9' }, { id:'cls2', name:'Grade 8', level:'8' }];
    save(K.classes, classes);
  }
  if (!streams.length) {
    streams = [{ id:'str1', name:'E/W', classId:'cls1' }, { id:'str2', name:'North', classId:'cls2' }];
    save(K.streams, streams);
  }
  if (!subjects.length) {
    subjects = [
      { id:'s1', name:'English',       code:'ENG', max:100, category:'Core',      teacherId:'', studentIds:[] },
      { id:'s2', name:'Kiswahili',      code:'KIS', max:100, category:'Languages', teacherId:'', studentIds:[] },
      { id:'s3', name:'Mathematics',    code:'MTH', max:100, category:'Core',      teacherId:'', studentIds:[] },
      { id:'s4', name:'Science',        code:'SCI', max:100, category:'Core',      teacherId:'', studentIds:[] },
      { id:'s5', name:'Social Studies', code:'SST', max:100, category:'Core',      teacherId:'', studentIds:[] },
      { id:'s6', name:'CRE',            code:'CRE', max:100, category:'Core',      teacherId:'', studentIds:[] },
      { id:'s7', name:'Creative Arts',  code:'ART', max:100, category:'Elective',  teacherId:'', studentIds:[] },
      { id:'s8', name:'Agriculture',    code:'AGR', max:100, category:'Technical', teacherId:'', studentIds:[] },
      { id:'s9', name:'Pre-Technical',  code:'PRT', max:100, category:'Technical', teacherId:'', studentIds:[] },
    ];
    save(K.subjects, subjects);
  }
  if (!students.length) {
    const raw = [];
    students = raw.map(r => ({
      id: uid(), adm:r[0], name:r[1], gender:r[2],
      classId:r[3], streamId:r[4], parent:r[5], contact:r[6], dob:'', notes:'',
      subjectIds: subjects.map(s=>s.id)
    }));
    save(K.students, students);
    // Enrol all in all subjects
    subjects.forEach(sub => { sub.studentIds = students.map(s=>s.id); });
    save(K.subjects, subjects);
  }
  if (!exams.length) {
    exams = [];
    save(K.exams, exams);
  }
  if (!marks.length) {
    const sampleData = [];
    sampleData.forEach(([adm, scores]) => {
      const stu = students.find(s=>s.adm===adm);
      if (!stu) return;
      subjects.forEach((sub, i) => {
        marks.push({ id:uid(), examId:'ex1', studentId:stu.id, subjectId:sub.id, score:scores[i]||0 });
      });
    });
    save(K.marks, marks);
  }
}

// ═══════════════ NAVIGATION ═══════════════
// Full go() defined at end of file (includes timetable support)
function openSidebar()  { document.getElementById('sidebar').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); }
function toggleSidebar() {
  const app = document.getElementById('app');
  const isCollapsed = app.classList.toggle('sidebar-collapsed');
  // On mobile, also handle open class
  if (window.innerWidth < 960) {
    if (isCollapsed) closeSidebar(); else openSidebar();
    app.classList.remove('sidebar-collapsed');
  }
}
function openExamTab(id, btn) {
  document.querySelectorAll('#s-exams .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#examTabBar .tb').forEach(b => b.classList.remove('active'));
  const p = document.getElementById(id); if (p) p.classList.add('active');
  if (btn) btn.classList.add('active');
  else { const b = document.querySelector(`#examTabBar .tb[onclick*="${id}"]`); if(b) b.classList.add('active'); }
  if (id === 'tabAnalyse') checkAnalyseAccess();
  if (id === 'tabMeritList') populateMeritDropdowns();
  if (id === 'tabUploadMarks') populateUmDropdowns();
  if (id === 'tabSubjectAnalysis') {
    // Populate exam dropdown and check access
    const saEx = document.getElementById('saExam');
    if (saEx) saEx.innerHTML = '<option value="">— Select Exam —</option>' + exams.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
    const allowed = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin'||
      (currentUser.role==='teacher' && !settings.restrictTeacherAnalytics && (currentUser.canAnalyse||currentUserIsClassTeacher())));
    document.getElementById('saAccessDenied').style.display = allowed ? 'none' : '';
    document.getElementById('saContent').style.display      = allowed ? '' : 'none';
  }
}

function setUmUploadMode(mode, btn) {
  document.querySelectorAll('#umExcelCard .tb').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('umSingleHint').style.display = mode==='single' ? '' : 'none';
  document.getElementById('umAllHint').style.display    = mode==='all'    ? '' : 'none';
}

// ═══════════════ DARK MODE ═══════════════
function toggleDark() { const d=document.body.classList.toggle('dark'); applyDark(d); }
function applyDark(d) {
  document.body.classList.toggle('dark',d);
  document.getElementById('dmIco').textContent = d?'☀️':'🌙';
  document.getElementById('dmLbl').textContent = d?'Light Mode':'Dark Mode';
  localStorage.setItem(K.dark, d?'1':'0');
}

// ═══════════════ DASHBOARD ═══════════════
let dashCharts = {};
function renderDashboard() {
  const sw = students.filter(s => getStudentTotalForLatestExam(s.id) !== null);
  const latestExam = exams[exams.length-1];
  const classMean = sw.length ? (sw.reduce((a,s)=>a+getStudentTotalForLatestExam(s.id),0)/sw.length/subjects.length).toFixed(2) : '—';

  document.getElementById('dashStats').innerHTML = `
    <div class="stat-card sc-blue"><div class="sc-num">${students.length}</div><div class="sc-lbl">Total Students</div><div class="sc-ico">🎓</div></div>
    <div class="stat-card sc-green"><div class="sc-num">${teachers.length}</div><div class="sc-lbl">Teachers</div><div class="sc-ico">👨‍🏫</div></div>
    <div class="stat-card sc-teal"><div class="sc-num">${subjects.length}</div><div class="sc-lbl">Subjects</div><div class="sc-ico">📚</div></div>
    <div class="stat-card sc-amber"><div class="sc-num">${exams.length}</div><div class="sc-lbl">Exams</div><div class="sc-ico">📝</div></div>
    <div class="stat-card sc-purple"><div class="sc-num">${classMean}</div><div class="sc-lbl">Latest Mean</div><div class="sc-ico">📊</div></div>
    <div class="stat-card sc-cyan"><div class="sc-num">${students.filter(s=>s.gender==='F').length}</div><div class="sc-lbl">Female Students</div><div class="sc-ico">👩</div></div>
  `;

  // Subject performance chart
  if (dashCharts.sub) { dashCharts.sub.destroy(); }
  if (latestExam && document.getElementById('dashSubChart')) {
    const subMeans = subjects.map(sub => {
      const subMarks = marks.filter(m => m.examId===latestExam.id && m.subjectId===sub.id);
      return subMarks.length ? (subMarks.reduce((a,m)=>a+m.score,0)/subMarks.length).toFixed(1) : 0;
    });
    dashCharts.sub = new Chart(document.getElementById('dashSubChart'), {
      type:'bar',
      data:{ labels:subjects.map(s=>s.code), datasets:[{
        label:'Mean Score', data:subMeans,
        backgroundColor:['#1a6fb5','#16a34a','#0d9488','#d97706','#7c3aed','#0891b2','#ea580c','#dc2626','#9333ea'],
        borderRadius:6
      }]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{grid:{color:'rgba(100,116,139,.1)'},min:0,max:100}} }
    });
  }

  // Gender pie
  if (dashCharts.gender) { dashCharts.gender.destroy(); }
  if (document.getElementById('dashGenderChart')) {
    const m = students.filter(s=>s.gender==='M').length;
    const f = students.filter(s=>s.gender==='F').length;
    dashCharts.gender = new Chart(document.getElementById('dashGenderChart'), {
      type:'doughnut',
      data:{ labels:['Male','Female'], datasets:[{data:[m,f],backgroundColor:['#1a6fb5','#db2777'],borderWidth:0}]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}}} }
    });
  }

  // Grade distribution chart
  if (dashCharts.gradeDist) { dashCharts.gradeDist.destroy(); }
  if (latestExam && document.getElementById('dashGradeChart')) {
    const latestMarks = marks.filter(m=>m.examId===latestExam.id);
    const gradeCount = {};
    latestMarks.forEach(m=>{const g=getGrade(m.score);gradeCount[g.grade]=(gradeCount[g.grade]||0)+1;});
    const gLabels=Object.keys(gradeCount); const gData=gLabels.map(k=>gradeCount[k]);
    const gColors=['#16a34a','#0d9488','#1a6fb5','#2563eb','#d97706','#ea580c','#dc2626','#991b1b'];
    dashCharts.gradeDist = new Chart(document.getElementById('dashGradeChart'),{
      type:'doughnut',
      data:{labels:gLabels,datasets:[{data:gData,backgroundColor:gColors.slice(0,gLabels.length),borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}}},cutout:'55%'}
    });
  }

  // Top 5
  if (latestExam) {
    const ranked = students
      .map(s => { const t=getStudentTotalForLatestExam(s.id); return t!==null?{...s,total:t}:null; })
      .filter(Boolean).sort((a,b)=>b.total-a.total).slice(0,5);
    document.getElementById('dashTop5').innerHTML = ranked.length ? ranked.map((s,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border-lt)">
        <div style="display:flex;align-items:center;gap:.6rem">
          <span class="badge ${i===0?'b-amber':i<3?'b-blue':'b-teal'}">#${i+1}</span>
          <span style="font-weight:600;font-size:.85rem">${s.name}</span>
        </div>
        <span style="font-weight:700;color:var(--primary)">${s.total}</span>
      </div>`).join('') : '<p style="color:var(--muted);text-align:center;padding:1rem">No marks data yet.</p>';
  }

  // Recent exams
  document.getElementById('dashRecentExams').innerHTML = exams.slice(-4).reverse().map(e=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border-lt)">
      <div><div style="font-weight:600;font-size:.85rem">${e.name}</div><div style="font-size:.75rem;color:var(--muted)">${e.type} · ${e.term} ${e.year}</div></div>
      <span class="badge b-blue">${e.subjectIds.length} subs</span>
    </div>`).join('') || '<p style="color:var(--muted);text-align:center;padding:1rem">No exams yet.</p>';
}

function getStudentTotalForLatestExam(studentId) {
  const latest = exams[exams.length-1];
  if (!latest) return null;
  const studentMarks = marks.filter(m => m.examId===latest.id && m.studentId===studentId);
  if (!studentMarks.length) return null;
  return studentMarks.reduce((a,m)=>a+m.score,0);
}

// ═══════════════ POPULATE DROPDOWNS ═══════════════
function populateAllDropdowns() {
  populateStrTeacherDropdown();
  // Classes
  ['examClass','stuClass','strClass','rpStream'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    if (id === 'rpStream') {
      el.innerHTML = '<option value="">— All Streams —</option>' + streams.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    } else {
      const ph = id==='examClass' ? '— All Classes —' : '— Select —';
      el.innerHTML = `<option value="">${ph}</option>` + classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    }
  });
  // Streams for student form
  const stuStr = document.getElementById('stuStream');
  if (stuStr) stuStr.innerHTML = '<option value="">— Select —</option>' + streams.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');

  // Teacher dropdown in subject form
  const subTch = document.getElementById('subTeacher');
  if (subTch) subTch.innerHTML = '<option value="">— None —</option>' + teachers.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');

  // Populate exam subject checkboxes
  renderExamSubjectCheckboxes();

  // Student class triggers stream update
  const stuCls = document.getElementById('stuClass');
  if (stuCls) stuCls.addEventListener('change', updateStuStreamDropdown);
}

function updateStuStreamDropdown() {
  const clsId = document.getElementById('stuClass').value;
  const stuStr = document.getElementById('stuStream');
  const filtered = clsId ? streams.filter(s=>s.classId===clsId) : streams;
  stuStr.innerHTML = '<option value="">— Select —</option>' + filtered.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
}

function populateGSDropdowns() {
  ['anGradingSystem'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const cur=el.value;
    el.innerHTML=gradingSystems.map(g=>`<option value="${g.id}" ${g.id===getActiveGradingSystemId()?'selected':''}>${g.name}</option>`).join('');
    if(cur)el.value=cur;
  });
}
function populateExamDropdowns() {
  const isTeacherForExams = currentUser && currentUser.role === 'teacher';
  const mySubIdsForExams = isTeacherForExams ? getMySubjectIds() : [];
  const myClassIdsForExams = isTeacherForExams
    ? [...new Set(getMyClassTeacherStreams().map(s => s.classId))]
    : [];
  const filteredExams = isTeacherForExams
    ? exams.filter(e => {
        const hasSubject = e.subjectIds.some(sid => mySubIdsForExams.includes(sid));
        const isMyClass  = !e.classId || myClassIdsForExams.length === 0 || myClassIdsForExams.includes(e.classId);
        return hasSubject || isMyClass;
      })
    : exams;
  ['umExam','anExam','mlExam','saExam'].forEach(id => {
    const el = document.getElementById(id); if(!el) return;
    // Consolidated exams cannot have marks uploaded — they are computed automatically
    const examList = id === 'umExam' ? filteredExams.filter(e => e.category !== 'consolidated') : filteredExams;
    el.innerHTML = '<option value="">— Select Exam —</option>' + examList.map(e=>`<option value="${e.id}">${e.name}</option>`).join('');
  });
}
function populateMeritDropdowns() {
  populateExamDropdowns();
  // Stream dropdown is populated on demand by onMlTypeChange
}
function populateUmDropdowns() {
  populateExamDropdowns();
  document.getElementById('umMode')?.addEventListener('change', function() {
    document.getElementById('umExcelCard').style.display = this.value==='excel' ? '' : 'none';
    document.getElementById('umManualCard').style.display = this.value==='manual' ? '' : 'none';
  });
}

function populateReportDropdowns() {
  const rpEx = document.getElementById('rpExam');
  if (rpEx) rpEx.innerHTML = '<option value="">— Select Exam —</option>' + exams.map(e=>`<option value="${e.id}">${e.name} (${e.term} ${e.year})</option>`).join('');
  const rpStu = document.getElementById('rpStudent');
  if (rpStu) {
    const sorted = [...students].sort((a,b)=>a.name.localeCompare(b.name));
    rpStu.innerHTML = '<option value="">— All Students —</option>' + sorted.map(s=>`<option value="${s.id}">${s.name} (${s.adm})</option>`).join('');
  }
  // Populate rpYear with years from exams + current year
  const rpYear = document.getElementById('rpYear');
  if (rpYear) {
    const years = [...new Set([...exams.map(e=>e.year), String(new Date().getFullYear())])].sort((a,b)=>b-a);
    rpYear.innerHTML = '<option value="">— Auto from Exam —</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
  }
}

// Called when exam selector changes — sync term/year dropdowns
function onRpExamChange() {
  const examId = document.getElementById('rpExam')?.value;
  const exam   = examId ? exams.find(e => e.id === examId) : null;
  const rpTerm = document.getElementById('rpTerm');
  const rpYear = document.getElementById('rpYear');
  if (exam) {
    // Auto-set term and year from exam (only if user hasn't manually picked)
    if (rpTerm && !rpTerm.dataset.manuallySet) {
      for (const opt of rpTerm.options) { if (opt.value === exam.term) { opt.selected = true; break; } }
    }
    if (rpYear && !rpYear.dataset.manuallySet) {
      for (const opt of rpYear.options) { if (opt.value === String(exam.year)) { opt.selected = true; break; } }
    }
  }
  onRpStudentChange();
  // Also update the stream dropdown
  const rpStream = document.getElementById('rpStream');
  if (rpStream) {
    const relevantStreams = exam?.classId ? streams.filter(s=>s.classId===exam.classId) : streams;
    rpStream.innerHTML = '<option value="">— All Streams —</option>' + relevantStreams.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  }
}

// Called when student changes
function onRpStudentChange() {
  refreshRpFeeAutoLink();
}

// Called when term or year manually changed
function onRpTermYearChange() {
  const rpTerm = document.getElementById('rpTerm');
  const rpYear = document.getElementById('rpYear');
  if (rpTerm) rpTerm.dataset.manuallySet = rpTerm.value ? '1' : '';
  if (rpYear) rpYear.dataset.manuallySet = rpYear.value ? '1' : '';
  refreshRpFeeAutoLink();
}

// Central fee auto-link refresh for report form
function refreshRpFeeAutoLink() {
  const examId  = document.getElementById('rpExam')?.value;
  const stuId   = document.getElementById('rpStudent')?.value;
  const exam    = examId ? exams.find(e => e.id === examId) : null;

  // Resolve effective term and year (manual overrides > exam auto)
  const rpTermVal = document.getElementById('rpTerm')?.value;
  const rpYearVal = document.getElementById('rpYear')?.value;
  const effectiveTerm = rpTermVal || (exam?.term) || '';
  const effectiveYear = rpYearVal || (exam?.year ? String(exam.year) : '');

  const balEl      = document.getElementById('rpFeeBalance');
  const nextTermEl = document.getElementById('rpFeeNextTerm');
  const statusEl   = document.getElementById('rpFeeAutoLinkText');
  const statusBox  = document.getElementById('rpFeeAutoLinkStatus');
  const badge      = document.getElementById('rpFeeStatusBadge');

  if (!effectiveTerm || !effectiveYear) {
    if (statusEl) statusEl.textContent = 'Select exam or set term/year to auto-link fees';
    return;
  }

  loadFees();

  if (stuId) {
    // Single student — show their exact balance
    const stu = students.find(s => s.id === stuId);
    const rec = feeRecords.find(r => r.studentId===stuId && r.term===effectiveTerm && String(r.year)===effectiveYear);
    if (rec) {
      const bal = getRecordBalance(rec);
      if (balEl && !balEl.dataset.manuallySet) balEl.value = bal;
      if (badge) {
        badge.style.display = '';
        badge.textContent   = bal <= 0 ? '✅ Cleared' : `⚠️ Owes KES ${bal.toLocaleString()}`;
        badge.style.color   = bal <= 0 ? '#16a34a' : '#dc2626';
      }
      if (statusEl) {
        statusEl.innerHTML = bal <= 0
          ? `<span style="color:#16a34a;font-weight:700">✅ Fees cleared</span> — ${effectiveTerm} ${effectiveYear}`
          : `<span style="color:#dc2626;font-weight:700">⚠️ KES ${bal.toLocaleString()} outstanding</span> — ${effectiveTerm} ${effectiveYear}`;
      }
      if (statusBox) statusBox.style.borderColor = bal <= 0 ? '#16a34a' : '#dc2626';
    } else {
      if (badge) { badge.style.display=''; badge.textContent='— No fee record'; badge.style.color='var(--muted)'; }
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--muted)">No fee record for ${effectiveTerm} ${effectiveYear}</span>`;
      if (statusBox) statusBox.style.borderColor = 'var(--border)';
    }
    // Next-term fee
    if (nextTermEl && !nextTermEl.dataset.manuallySet && stu) {
      const termMap = {'Term 1':'Term 2','Term 2':'Term 3','Term 3':'Term 1'};
      const nxtTerm = termMap[effectiveTerm] || effectiveTerm;
      const nxtYear = effectiveTerm==='Term 3' ? String(parseInt(effectiveYear)+1) : effectiveYear;
      const struct  = feeStructures.find(f => f.classId===stu.classId && f.term===nxtTerm && String(f.year)===nxtYear);
      if (struct) nextTermEl.value = struct.totalFee;
    }
  } else {
    // No student — show class/school-wide summary for this term/year
    const examClassId = exam?.classId;
    let totalRec=0, totalPaid=0, totalBal=0;
    feeRecords.filter(r => r.term===effectiveTerm && String(r.year)===effectiveYear && (!examClassId || r.classId===examClassId)).forEach(r => {
      totalRec++;
      totalPaid += getRecordTotalPaid(r);
      totalBal  += getRecordBalance(r);
    });
    if (statusEl) {
      statusEl.innerHTML = totalRec
        ? `🔗 <strong>${effectiveTerm} ${effectiveYear}</strong> — ${totalRec} records | Paid: KES ${totalPaid.toLocaleString()} | Outstanding: <span style="color:${totalBal>0?'#dc2626':'#16a34a'}">KES ${totalBal.toLocaleString()}</span>`
        : `🔗 <strong>${effectiveTerm} ${effectiveYear}</strong> — No fee records found`;
    }
    if (statusBox) statusBox.style.borderColor = totalBal > 0 ? '#f59e0b' : 'var(--border)';
  }
}

// ═══════════════ UPLOAD MARKS: Dynamic subject load ═══════════════

function loadUmStudents() {
  const examId   = document.getElementById('umExam').value;
  const subjectId= document.getElementById('umSubject').value;
  const streamId = document.getElementById('umStream').value;
  const body     = document.getElementById('umBody');
  const empty    = document.getElementById('umEmpty');
  const maxLabel = document.getElementById('umMaxLabel');
  const subLabel = document.getElementById('umSubjectLabel');
  body.innerHTML = '';

  if (!examId || !subjectId) { empty.style.display=''; return; }
  empty.style.display = 'none';

  const sub = subjects.find(s=>s.id===subjectId);
  if (!sub) return;
  maxLabel.textContent = `(Max: ${sub.max})`;
  subLabel.textContent = `— ${sub.name}`;

  // Determine if current user is a teacher (hide grade/points from teachers)
  const isTeacher = currentUser && currentUser.role === 'teacher';

  // Toggle grade/points columns visibility
  document.querySelectorAll('.um-grade-col, .um-points-col').forEach(el => {
    el.style.display = isTeacher ? 'none' : '';
  });

  // Get enrolled students for this subject, filtered by selected stream
  const enrolledIds = sub.studentIds && sub.studentIds.length ? sub.studentIds : students.map(s=>s.id);
  let enrolled = students.filter(s => enrolledIds.includes(s.id));

  // Filter by stream if selected
  if (streamId) {
    enrolled = enrolled.filter(s => s.streamId === streamId);
  }
  // Always sort alphabetically
  enrolled.sort((a,b) => a.name.localeCompare(b.name));

  if (!enrolled.length) { empty.textContent='No students found in this stream for the selected subject.'; empty.style.display=''; return; }

  enrolled.forEach((stu, idx) => {
    const existing = marks.find(m => m.examId===examId && m.studentId===stu.id && m.subjectId===subjectId);
    const score    = existing ? existing.score : '';
    const g        = score !== '' ? getGrade(score, sub.max) : null;
    const cls      = g ? (g.points>=6?'good':g.points>=4?'avg':'poor') : '';
    const stream   = streams.find(s=>s.id===stu.streamId);

    const gradeCell   = isTeacher ? '' : `<td id="gr_${stu.id}">${g ? gradeTag(g) : '—'}</td>`;
    const pointsCell  = isTeacher ? '' : `<td id="pt_${stu.id}">${g ? g.points : '—'}</td>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td style="font-family:var(--mono);font-size:.82rem">${stu.adm}</td>
      <td style="font-weight:600">${stu.name}</td>
      <td><span class="badge ${stu.gender==='M'?'b-m':'b-f'}">${stu.gender}</span></td>
      <td>${stream?stream.name:'—'}</td>
      <td>
        <input type="number" class="marks-input ${cls}" id="mk_${stu.id}"
          min="0" max="${sub.max}" value="${score}"
          data-stuId="${stu.id}" data-idx="${idx}" data-total="${enrolled.length}"
          oninput="onMarkInput(this)" onkeydown="onMarkKey(event,this)"/>
      </td>
      ${gradeCell}
      ${pointsCell}
    `;
    body.appendChild(tr);
  });
}

function onMarkInput(inp) {
  const val = parseInt(inp.value);
  const sub = subjects.find(s=>s.id===document.getElementById('umSubject').value);
  const max = sub ? sub.max : 100;
  const isTeacher = currentUser && currentUser.role === 'teacher';
  if (!isNaN(val) && val >= 0 && val <= max) {
    const g = getGrade(val, max);
    if (!isTeacher) {
      const grEl = document.getElementById('gr_'+inp.dataset.stuId);
      const ptEl = document.getElementById('pt_'+inp.dataset.stuId);
      if (grEl) grEl.innerHTML = gradeTag(g);
      if (ptEl) ptEl.textContent = g.points;
    }
    inp.className = 'marks-input ' + (g.points>=6?'good':g.points>=4?'avg':'poor');
    autoSaveMark(inp.dataset.stuId, val);
  }
}

function onMarkKey(e, inp) {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    const idx   = parseInt(inp.dataset.idx);
    const total = parseInt(inp.dataset.total);
    const next  = idx + 1;
    if (next < total) {
      const allInputs = document.querySelectorAll('.marks-input');
      if (allInputs[next]) allInputs[next].focus();
    }
  }
}

function autoSaveMark(studentId, score) {
  const examId    = document.getElementById('umExam').value;
  const subjectId = document.getElementById('umSubject').value;
  const existing  = marks.findIndex(m => m.examId===examId && m.studentId===studentId && m.subjectId===subjectId);
  if (existing > -1) marks[existing].score = score;
  else marks.push({ id:uid(), examId, studentId, subjectId, score });
  save(K.marks, marks);
}

function saveAllMarks() {
  const examId    = document.getElementById('umExam').value;
  const subjectId = document.getElementById('umSubject').value;
  const streamId  = document.getElementById('umStream').value;
  if (!examId||!streamId||!subjectId) { showToast('Select exam, class, stream and subject first','error'); return; }
  document.querySelectorAll('.marks-input').forEach(inp => {
    const val = parseInt(inp.value);
    if (!isNaN(val)) autoSaveMark(inp.dataset.stuId, val);
  });
  showToast('All marks saved ✓','success');
  renderDashboard();
}

// ═══════════════ MARKS EXCEL UPLOAD ═══════════════
// Supports TWO modes:
//   A) Single-subject: columns AdmNo, Name, Marks  (when a subject is selected)
//   B) All-subjects:   columns AdmNo, Name, [SubjectCode or SubjectName per column]
function handleMarksUpload(input) {
  const file = input.files[0]; if (!file) return;
  const examId    = document.getElementById('umExam').value;
  const subjectId = document.getElementById('umSubject').value;
  if (!examId) { showToast('Select an exam first','error'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      if (!data.length) { showToast('File is empty','warning'); return; }

      // Detect mode: if file has "Marks" column → single subject mode
      // If file has subject codes/names as columns → all-subjects mode
      const firstRow  = data[0];
      const colKeys   = Object.keys(firstRow);
      const hasSingle = colKeys.some(k => k.toLowerCase()==='marks' || k.toLowerCase()==='score');

      let count = 0, skipped = 0;

      if (hasSingle || subjectId) {
        // ── MODE A: single subject ──
        const sub = subjects.find(s => s.id === subjectId);
        if (!sub && !hasSingle) { showToast('Select a subject for single-subject upload','error'); return; }
        data.forEach(row => {
          const adm   = String(row['AdmNo']||row['admno']||row['Adm No']||'').trim();
          const score = parseInt(row['Marks']||row['marks']||row['Score']||row['score']||0);
          const stu   = students.find(s => s.adm === adm); if (!stu) { skipped++; return; }
          const maxM  = sub ? sub.max : 100;
          // Temporarily set subjectId for autoSaveMark
          const origSubId = document.getElementById('umSubject').value;
          if (subjectId) {
            autoSaveMark(stu.id, Math.min(Math.max(score,0), maxM));
          }
          count++;
        });
        showToast(`${count} marks uploaded${skipped?' ('+skipped+' skipped)':''} ✓`, 'success');
        loadUmStudents();

      } else {
        // ── MODE B: all subjects in one file ──
        // Map column headers to subject ids
        // Column can be subject code (ENG, KIS...) or subject name (English, Kiswahili...)
        const exam = exams.find(e => e.id === examId);
        const examSubIds = exam ? exam.subjectIds : subjects.map(s=>s.id);
        const colSubMap = {}; // colKey → { subjectId, maxMarks }
        colKeys.forEach(col => {
          const colU = col.trim().toUpperCase();
          const byCode = subjects.find(s => s.code.toUpperCase() === colU && examSubIds.includes(s.id));
          const byName = subjects.find(s => s.name.toUpperCase() === col.trim().toUpperCase() && examSubIds.includes(s.id));
          const matched = byCode || byName;
          if (matched) colSubMap[col] = { subjectId: matched.id, max: matched.max };
        });

        if (!Object.keys(colSubMap).length) {
          showToast('No subject columns found. Use subject codes (ENG, KIS, MTH…) or names as column headers.','error');
          return;
        }

        data.forEach(row => {
          const adm = String(row['AdmNo']||row['admno']||row['Adm No']||'').trim();
          const stu = students.find(s => s.adm === adm); if (!stu) { skipped++; return; }
          let rowSaved = 0;
          Object.entries(colSubMap).forEach(([col, {subjectId:sid, max}]) => {
            const raw   = row[col];
            const score = parseInt(raw);
            if (isNaN(score)) return;
            const clampedScore = Math.min(Math.max(score,0), max);
            const existing = marks.findIndex(m => m.examId===examId && m.studentId===stu.id && m.subjectId===sid);
            if (existing > -1) marks[existing].score = clampedScore;
            else marks.push({ id:uid(), examId, studentId:stu.id, subjectId:sid, score:clampedScore });
            rowSaved++;
          });
          if (rowSaved) count++;
        });
        save(K.marks, marks);
        showToast(`All-subjects upload: ${count} students processed${skipped?' ('+skipped+' not found)':''} ✓`, 'success');
        loadUmStudents();
        renderDashboard();
      }
    } catch(err) { showToast('Error reading file: ' + err.message, 'error'); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

// Download template for ALL subjects (for bulk upload)
function downloadAllSubjectsTemplate() {
  const examId  = document.getElementById('umExam').value;
  const streamId= document.getElementById('umStream').value;
  const exam    = examId ? exams.find(e=>e.id===examId) : null;
  const examSubIds = exam ? exam.subjectIds : subjects.map(s=>s.id);
  const examSubs   = examSubIds.map(sid=>subjects.find(s=>s.id===sid)).filter(Boolean);

  // Build student list filtered by stream
  let studentList = students;
  if (streamId) studentList = studentList.filter(s=>s.streamId===streamId);
  studentList = [...studentList].sort((a,b)=>a.name.localeCompare(b.name));

  let data;
  if (studentList.length) {
    data = studentList.map(s => {
      const row = { AdmNo: s.adm, Name: s.name };
      examSubs.forEach(sub => { row[sub.code] = ''; });
      return row;
    });
  } else {
    const row = { AdmNo: 'A000000001', Name: 'Student Name' };
    examSubs.forEach(sub => { row[sub.code] = ''; });
    data = [row];
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'All Marks');
  XLSX.writeFile(wb, `all_subjects_template${exam?'_'+exam.name:''}.xlsx`);
}

function downloadMarksTemplate() {
  const examId    = document.getElementById('umExam').value;
  const subjectId = document.getElementById('umSubject').value;
  const streamId  = document.getElementById('umStream').value;
  const sub = subjects.find(s=>s.id===subjectId);
  const enrolledIds = sub?.studentIds?.length ? sub.studentIds : students.map(s=>s.id);
  let enrolled = students.filter(s=>enrolledIds.includes(s.id));
  if (streamId) enrolled = enrolled.filter(s=>s.streamId===streamId);
  enrolled.sort((a,b)=>a.name.localeCompare(b.name));
  const data = enrolled.map(s=>({ AdmNo:s.adm, Name:s.name, Marks:'' }));
  if (!data.length) data.push({ AdmNo:'A000000001', Name:'Student Name', Marks:0 });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Marks');
  XLSX.writeFile(wb, `marks_template_${sub?.code||'subject'}.xlsx`);
}

function exportMarksExcel() {
  const examId    = document.getElementById('umExam').value;
  const subjectId = document.getElementById('umSubject').value;
  const streamId  = document.getElementById('umStream').value;
  if (!examId||!subjectId) { showToast('Select exam and subject first','error'); return; }
  const sub = subjects.find(s=>s.id===subjectId);
  let studentList = students;
  if (streamId) studentList = studentList.filter(s=>s.streamId===streamId);
  const data = studentList.map(s => {
    const m = marks.find(mk=>mk.examId===examId&&mk.studentId===s.id&&mk.subjectId===subjectId);
    const g = m ? getGrade(m.score, sub?.max||100) : null;
    return { AdmNo:s.adm, Name:s.name, Gender:s.gender, Marks:m?m.score:'', Grade:g?g.grade:'', Points:g?g.points:'' };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Marks');
  XLSX.writeFile(wb, `marks_${sub?.code||'subject'}.xlsx`);
}

// ═══════════════ EXAM CATEGORY UI ═══════════════
let currentExamCategory = 'regular'; // 'regular' | 'consolidated'

function setExamCategory(cat) {
  currentExamCategory = cat;
  document.getElementById('catBtnRegular').classList.toggle('active', cat === 'regular');
  document.getElementById('catBtnConsolidated').classList.toggle('active', cat === 'consolidated');
  document.getElementById('examTypeWrap').style.display = cat === 'regular' ? '' : 'none';
  document.getElementById('examConsolidatedWrap').style.display = cat === 'consolidated' ? '' : 'none';
  document.getElementById('consolidatedSourceWrap').style.display = cat === 'consolidated' ? '' : 'none';
  if (cat === 'consolidated') renderConsolidatedSourceCheckboxes();
}

function renderExamSubjectCheckboxes(selectedIds) {
  const wrap = document.getElementById('examSubjectCheckboxes');
  if (!wrap) return;
  wrap.innerHTML = subjects.map(s => `
    <label class="sub-check-label">
      <input type="checkbox" value="${s.id}" class="exam-sub-chk" ${selectedIds && selectedIds.includes(s.id) ? 'checked' : ''} onchange="updateExamSelectAll()"/>
      <span class="sub-chk-code badge b-teal" style="font-size:.65rem">${s.code}</span>
      <span class="sub-chk-name">${s.name}</span>
    </label>`).join('');
  updateExamSelectAll();
}

function toggleExamAllSubjects(cb) {
  document.querySelectorAll('#examSubjectCheckboxes input[type=checkbox]').forEach(c => c.checked = cb.checked);
}

function updateExamSelectAll() {
  const all = document.querySelectorAll('#examSubjectCheckboxes input[type=checkbox]');
  const checked = document.querySelectorAll('#examSubjectCheckboxes input[type=checkbox]:checked');
  const sa = document.getElementById('examSelectAllSubjects');
  if (sa) { sa.checked = all.length > 0 && checked.length === all.length; sa.indeterminate = checked.length > 0 && checked.length < all.length; }
}

function renderConsolidatedSourceCheckboxes(selectedIds) {
  const wrap = document.getElementById('consolidatedSourceCheckboxes');
  if (!wrap) return;
  const regularExams = exams.filter(e => e.category !== 'consolidated');
  if (!regularExams.length) { wrap.innerHTML = '<p style="color:var(--muted);font-size:.82rem">No regular exams available yet.</p>'; return; }
  wrap.innerHTML = regularExams.map(e => `
    <label class="sub-check-label">
      <input type="checkbox" value="${e.id}" class="consol-src-chk" ${selectedIds && selectedIds.includes(e.id) ? 'checked' : ''}/>
      <span class="sub-chk-code badge b-blue" style="font-size:.65rem">${e.type||'Exam'}</span>
      <span class="sub-chk-name">${e.name} (${e.term} ${e.year})</span>
    </label>`).join('');
}

// ═══════════════ EXAMS CRUD ═══════════════
function saveExam() {
  if (currentUser && currentUser.role === 'teacher') { showToast('Teachers cannot create exams','error'); return; }
  const name  = document.getElementById('examName').value.trim();
  const term  = document.getElementById('examTerm').value;
  const year  = document.getElementById('examYear').value;
  const date  = document.getElementById('examDate').value;
  const clsId = document.getElementById('examClass').value;
  const notes = document.getElementById('examNotes').value;
  const subIds = [...document.querySelectorAll('#examSubjectCheckboxes input[type=checkbox]:checked')].map(cb => cb.value);
  const cat   = currentExamCategory;

  let type = '';
  if (cat === 'regular') {
    type = document.getElementById('examType').value;
    if (!name || !type) { showToast('Name and exam type are required','error'); return; }
  } else {
    const scope = document.getElementById('examConsolidatedScope').value;
    type = 'Consolidated';
    if (!name) { showToast('Exam name is required','error'); return; }
  }
  if (!subIds.length) { showToast('Select at least one subject','error'); return; }

  const sourceExamIds = cat === 'consolidated'
    ? [...document.querySelectorAll('.consol-src-chk:checked')].map(cb => cb.value)
    : [];

  const editId = document.getElementById('editExamId').value;
  if (editId) {
    const i = exams.findIndex(e => e.id === editId);
    if (i > -1) exams[i] = { ...exams[i], name, category:cat, type, term, year, date, classId:clsId, subjectIds:subIds, sourceExamIds, notes };
    showToast('Exam updated ✓','success');
  } else {
    exams.push({ id:uid(), name, category:cat, type, term, year, date, classId:clsId, subjectIds:subIds, sourceExamIds, notes });
    showToast('Exam created ✓','success');
  }
  save(K.exams, exams);
  cancelExamEdit(); renderExamList(); populateExamDropdowns();
}

function renderExamList() {
  document.getElementById('examListBody').innerHTML = exams.map((e,i)=>{
    const catBadge = e.category === 'consolidated'
      ? '<span class="badge b-purple" style="font-size:.65rem">Consolidated</span>'
      : '<span class="badge b-teal" style="font-size:.65rem">Regular</span>';
    return `<tr>
      <td>${i+1}</td><td><strong>${e.name}</strong></td>
      <td>${catBadge}</td>
      <td><span class="badge b-blue">${e.type}</span></td>
      <td>${e.term}</td><td>${e.year}</td>
      <td>${classes.find(c=>c.id===e.classId)?.name||'All'}</td>
      <td>${e.subjectIds.length} subjects</td>
      <td>${e.date||'—'}</td>
      <td><div class="act-cell">
        <button class="icb ed" onclick="editExam('${e.id}')" title="Edit">✏️</button>
        <button class="icb dl" onclick="deleteExam('${e.id}')" title="Delete">🗑️</button>
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:1.5rem">No exams yet.</td></tr>';
}

function editExam(id) {
  const e=exams.find(x=>x.id===id); if(!e) return;
  document.getElementById('editExamId').value=e.id;
  document.getElementById('examName').value=e.name;
  document.getElementById('examTerm').value=e.term;
  document.getElementById('examYear').value=e.year;
  document.getElementById('examDate').value=e.date||'';
  document.getElementById('examClass').value=e.classId||'';
  document.getElementById('examNotes').value=e.notes||'';
  // Restore category
  const cat = e.category || 'regular';
  setExamCategory(cat);
  if (cat === 'regular') {
    document.getElementById('examType').value=e.type||'';
  } else {
    const scopeSel = document.getElementById('examConsolidatedScope');
    if (scopeSel) scopeSel.value = e.consolidatedScope || 'term';
    renderConsolidatedSourceCheckboxes(e.sourceExamIds || []);
  }
  renderExamSubjectCheckboxes(e.subjectIds || []);
  document.getElementById('examFormTitle').textContent='✏️ Edit Exam';
  openExamTab('tabCreateExam');
}
function cancelExamEdit() {
  ['editExamId','examName','examNotes','examDate'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('examType').value=''; document.getElementById('examYear').value='2025';
  document.getElementById('examFormTitle').textContent='➕ Create New Exam';
  setExamCategory('regular');
  renderExamSubjectCheckboxes([]);
}
function deleteExam(id) {
  if(!confirm('Delete this exam? All marks for this exam will also be removed.')) return;
  exams=exams.filter(e=>e.id!==id);
  marks=marks.filter(m=>m.examId!==id);
  save(K.exams,exams); save(K.marks,marks);
  renderExamList(); populateExamDropdowns();
  showToast('Exam deleted','info');
}

// ═══════════════ ANALYSIS ═══════════════
let anCharts = {};

// ═══════════════ MERIT LIST ═══════════════

// Build a scored+ranked array for an exam, optionally filtered to a stream
function buildMeritData(examId, filterStreamId) {
  const exam      = exams.find(e => e.id === examId); if (!exam) return [];
  const examMarks = marks.filter(m => m.examId === examId);
  const totalSubs = exam.subjectIds.length || 1;
  let   stuList   = students.filter(s => {
    // Only include students who belong to a class/stream for this exam
    if (exam.classId && s.classId !== exam.classId) return false;
    return true;
  });
  if (filterStreamId) stuList = stuList.filter(s => s.streamId === filterStreamId);

  const scored = stuList.map(stu => {
    const stuMarks = examMarks.filter(m => m.studentId === stu.id);
    if (!stuMarks.length) return null;
    const total  = stuMarks.reduce((a,m) => a+m.score, 0);
    const mean   = total / totalSubs;
    const maxAvg = (exam.subjectIds.map(sid=>subjects.find(s=>s.id===sid)?.max||100).reduce((a,b)=>a+b,0)/totalSubs) || 100;
    const g      = getMeanGrade(mean / maxAvg * 8);
    const pts    = stuMarks.reduce((a,m) => a + getGrade(m.score, subjects.find(s=>s.id===m.subjectId)?.max||100).points, 0);
    return { ...stu, total, mean, grade:g, points:pts };
  }).filter(Boolean).sort((a,b) => b.total - a.total);

  // Assign overall rank
  scored.forEach((s,i) => { s.overallRank = i+1; });

  // Assign stream rank within the result set
  const byStream = {};
  scored.forEach(s => {
    const key = s.streamId||'none';
    if (!byStream[key]) byStream[key] = [];
    byStream[key].push(s);
  });
  Object.values(byStream).forEach(grp => grp.forEach((s,i) => s.streamRank = i+1));

  return scored;
}

// Build subject-analysis block (grade distribution + gender means per subject)
function buildSubjectAnalysisHTML(examId, scopeStudentIds) {
  const exam      = exams.find(e => e.id === examId); if (!exam) return '';
  const examMarks = marks.filter(m => m.examId === examId &&
    (scopeStudentIds ? scopeStudentIds.includes(m.studentId) : true));
  const gs        = getActiveGradingSystem();
  const gradeKeys = gs.bands.map(b => b.grade);

  const rows = exam.subjectIds.map(sid => {
    const sub      = subjects.find(s => s.id === sid); if (!sub) return '';
    const subMarks = examMarks.filter(m => m.subjectId === sid);
    if (!subMarks.length) return '';
    const vals     = subMarks.map(m => m.score);
    const mn       = vals.reduce((a,b)=>a+b,0) / vals.length;
    const mx       = Math.max(...vals);
    const lo       = Math.min(...vals);

    // grade distribution counts
    const distCounts = {};
    gradeKeys.forEach(g => distCounts[g] = 0);
    subMarks.forEach(m => {
      const g = getGrade(m.score, sub.max);
      if (distCounts[g.grade] !== undefined) distCounts[g.grade]++;
    });

    // gender means
    const maleVals   = subMarks.filter(m => { const s=students.find(x=>x.id===m.studentId); return s && s.gender==='M'; }).map(m=>m.score);
    const femaleVals = subMarks.filter(m => { const s=students.find(x=>x.id===m.studentId); return s && s.gender==='F'; }).map(m=>m.score);
    const mMn = maleVals.length   ? (maleVals.reduce((a,b)=>a+b,0)/maleVals.length).toFixed(1)   : '—';
    const fMn = femaleVals.length ? (femaleVals.reduce((a,b)=>a+b,0)/femaleVals.length).toFixed(1) : '—';

    const distCells = gradeKeys.map(g =>
      `<td style="text-align:center;font-size:.78rem">${distCounts[g] || ''}</td>`
    ).join('');

    const mainGrade = getGrade(mn, sub.max);

    return `<tr>
      <td><strong>${sub.name}</strong></td>
      <td>${vals.length}</td>
      <td><strong style="color:var(--primary)">${mn.toFixed(1)}</strong></td>
      <td><span class="badge b-green">${mx}</span></td>
      <td><span class="badge b-red">${lo}</span></td>
      ${distCells}
      <td style="text-align:center"><span class="badge ${mainGrade.cls}">${mainGrade.grade}</span></td>
      <td style="text-align:center">${mMn}</td>
      <td style="text-align:center">${fMn}</td>
    </tr>`;
  }).join('');

  const gradeHeaders = gradeKeys.map(g => `<th style="text-align:center;font-size:.7rem">${g}</th>`).join('');

  return `
  <div style="margin-top:1.25rem">
    <h4 style="font-family:var(--font);font-weight:700;font-size:.95rem;margin-bottom:.75rem;color:var(--primary)">📊 Subject Analysis — Grade Distribution & Gender Performance</h4>
    <div class="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th rowspan="2">Subject</th>
            <th rowspan="2">Entries</th>
            <th rowspan="2">Mean</th>
            <th rowspan="2">High</th>
            <th rowspan="2">Low</th>
            <th colspan="${gradeKeys.length}" style="text-align:center;background:var(--primary-lt);color:var(--primary)">Grade Distribution</th>
            <th rowspan="2">Overall Grade</th>
            <th rowspan="2" style="text-align:center">♂ Mean</th>
            <th rowspan="2" style="text-align:center">♀ Mean</th>
          </tr>
          <tr>${gradeHeaders}</tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="20" style="text-align:center;color:var(--muted)">No data</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}

// Build the HTML rows for a merit list table (shared by overall + per-stream)
function buildMeritTableHTML(scored, examId, showStreamCol) {
  const exam       = exams.find(e => e.id === examId); if (!exam) return '';
  const examMarks  = marks.filter(m => m.examId === examId);
  const examSubIds = exam.subjectIds;
  const examSubs   = examSubIds.map(sid => subjects.find(s=>s.id===sid)).filter(Boolean);

  const subHeaders = examSubs.map(s=>`<th style="text-align:center;font-size:.72rem" title="${s.name}">${s.code}</th>`).join('');
  const colCount   = 6 + (showStreamCol?2:0) + examSubs.length + 4;

  const headerRow = `<tr>
    <th>Rank</th><th>Adm No</th><th>Name</th><th>G</th>
    ${showStreamCol ? '<th>Stream</th><th>Str.Pos</th>' : ''}
    ${subHeaders}
    <th>Total</th><th>Mean</th><th>Grade</th><th>Points</th>
  </tr>`;

  const bodyRows = scored.length ? scored.map(s => {
    const stream   = streams.find(x=>x.id===s.streamId);
    const subCells = examSubs.map(sub => {
      const mk = examMarks.find(m=>m.studentId===s.id && m.subjectId===sub.id);
      const g  = mk ? getGrade(mk.score, sub.max) : null;
      return `<td style="text-align:center;font-size:.78rem">${mk
        ? `<span style="font-weight:600">${mk.score}</span><br><span style="font-size:.62rem;color:var(--muted)">${g?.grade||''}</span>`
        : '—'}</td>`;
    }).join('');
    return `<tr>
      <td><span class="badge ${s.overallRank===1?'b-amber':s.overallRank<=3?'b-blue':'b-teal'}">#${s.overallRank}</span></td>
      <td style="font-family:var(--mono);font-size:.78rem">${s.adm}</td>
      <td><strong style="font-size:.85rem">${s.name}</strong></td>
      <td><span class="badge ${s.gender==='M'?'b-m':'b-f'}" style="font-size:.65rem">${s.gender}</span></td>
      ${showStreamCol ? `<td>${stream?.name||'—'}</td><td>#${s.streamRank}</td>` : ''}
      ${subCells}
      <td><strong>${s.total}</strong></td>
      <td>${s.mean.toFixed(2)}</td>
      <td>${gradeTag(s.grade)}</td>
      <td>${s.points}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="${colCount}" style="text-align:center;color:var(--muted);padding:1.5rem">No marks data.</td></tr>`;

  return { headerRow, bodyRows, examSubs, colCount };
}

// renderMeritList — full implementation is at the bottom of this file (overrides this stub)

function printMeritList() { window.print(); }

function exportMeritExcel() {
  const examId = document.getElementById('mlExam').value; if (!examId) { showToast('Select an exam','error'); return; }
  const exam   = exams.find(e=>e.id===examId);
  const mlType = document.getElementById('mlType')?.value || 'class_overall_and_stream';
  const streamFilter = mlType === 'class_stream' ? (document.getElementById('mlStream')?.value||null) : null;
  const scored = buildMeritData(examId, streamFilter);
  const examSubs = (exam?.subjectIds||[]).map(sid=>subjects.find(s=>s.id===sid)).filter(Boolean);
  const examMarks= marks.filter(m=>m.examId===examId);
  const wb = XLSX.utils.book_new();

  const rows = scored.map(s => {
    const stream = streams.find(x=>x.id===s.streamId);
    const row = {
      Rank:s.overallRank, StreamPos:'#'+s.streamRank,
      AdmNo:s.adm, Name:s.name, Gender:s.gender,
      Class: classes.find(c=>c.id===s.classId)?.name||'',
      Stream: stream?.name||'',
    };
    examSubs.forEach(sub => {
      const mk = examMarks.find(m=>m.studentId===s.id&&m.subjectId===sub.id);
      row[sub.code] = mk ? mk.score : '';
    });
    row['Total']  = s.total;
    row['Mean']   = s.mean.toFixed(2);
    row['Grade']  = s.grade?.grade||'';
    row['Points'] = s.points;
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Merit List');

  // Subject analysis sheet
  const gs = getActiveGradingSystem();
  const gradeKeys = gs.bands.map(b=>b.grade);
  const subRows = (exam?.subjectIds||[]).map(sid=>{
    const sub = subjects.find(s=>s.id===sid); if(!sub) return null;
    const subMarks = examMarks.filter(m=>m.subjectId===sid);
    const vals = subMarks.map(m=>m.score);
    const mn   = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    const dist = {};
    gradeKeys.forEach(g=>dist[g]=0);
    subMarks.forEach(m=>{ const g=getGrade(m.score,sub.max); if(dist[g.grade]!==undefined)dist[g.grade]++; });
    const maleV  = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='M';}).map(m=>m.score);
    const femV   = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='F';}).map(m=>m.score);
    const row = { Subject:sub.name, Entries:vals.length, Mean:mn.toFixed(1), Highest:vals.length?Math.max(...vals):'', Lowest:vals.length?Math.min(...vals):'' };
    gradeKeys.forEach(g=>row[g]=dist[g]);
    row['Male Mean']   = maleV.length   ? (maleV.reduce((a,b)=>a+b,0)/maleV.length).toFixed(1) : '';
    row['Female Mean'] = femV.length    ? (femV.reduce((a,b)=>a+b,0)/femV.length).toFixed(1) : '';
    return row;
  }).filter(Boolean);
  const ws2 = XLSX.utils.json_to_sheet(subRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Subject Analysis');

  XLSX.writeFile(wb, `merit_${exam?.name||'exam'}.xlsx`);
  showToast('Merit list exported to Excel ✓','success');
}

// ─── PDF EXPORT FOR MERIT LIST ───────────────────────────────
function exportMeritPDF() {
  const examId = document.getElementById('mlExam').value;
  if (!examId) { showToast('Select an exam first','error'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const exam      = exams.find(e=>e.id===examId);
    const mlType    = document.getElementById('mlType')?.value || 'class_overall_and_stream';
    const filterStr = mlType === 'class_stream' ? (document.getElementById('mlStream')?.value||null) : null;
    const scored    = buildMeritData(examId, filterStr||null);
    const examSubs  = (exam?.subjectIds||[]).map(sid=>subjects.find(s=>s.id===sid)).filter(Boolean);
    const examMarks = marks.filter(m=>m.examId===examId);
    const gs        = getActiveGradingSystem();
    const gradeKeys = gs.bands.map(b=>b.grade);
    const sch       = settings;

    // Landscape for wide tables
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const PW  = doc.internal.pageSize.getWidth();

    const addPageHeader = (title, subtitle='') => {
      doc.setFillColor(26,111,181);
      doc.rect(0,0,PW,16,'F');
      doc.setFontSize(12); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
      doc.text(sch.schoolName||'School', 14, 10);
      doc.setFontSize(9); doc.setFont(undefined,'normal');
      doc.text(`${exam?.name||''} | ${exam?.term||''} ${exam?.year||''}`, PW-14, 10, {align:'right'});
      doc.setFontSize(11); doc.setFont(undefined,'bold'); doc.setTextColor(26,111,181);
      doc.text(title, 14, 24);
      if (subtitle) { doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(100,116,139); doc.text(subtitle, 14, 30); }
      doc.setTextColor(0,0,0);
    };

    // ── PAGE 1: Overall merit list ──
    addPageHeader('OVERALL MERIT LIST', `${sch.address||''} | Printed: ${new Date().toLocaleDateString()}`);
    const meritHead = [['#','Adm No','Name','G','Stream','Str.P', ...examSubs.map(s=>s.code), 'Total','Mean','Grade','Pts']];
    const meritBody = scored.map(s => {
      const stream = streams.find(x=>x.id===s.streamId);
      const subScores = examSubs.map(sub=>{
        const mk=examMarks.find(m=>m.studentId===s.id&&m.subjectId===sub.id);
        return mk ? String(mk.score) : '—';
      });
      return [s.overallRank, s.adm, s.name, s.gender, stream?.name||'—', '#'+s.streamRank,
              ...subScores, s.total, s.mean.toFixed(2), s.grade?.grade||'—', s.points];
    });
    doc.autoTable({
      startY: 34, head: meritHead, body: meritBody,
      theme:'striped', styles:{fontSize:7, cellPadding:1.5},
      headStyles:{fillColor:[26,111,181], textColor:255, fontStyle:'bold', fontSize:7},
      alternateRowStyles:{fillColor:[240,247,255]},
      columnStyles:{ 0:{cellWidth:8}, 1:{cellWidth:22, font:'courier'}, 2:{cellWidth:30}, 3:{cellWidth:7} },
    });

    // ── PAGE 2+: Subject analysis ──
    doc.addPage();
    addPageHeader('SUBJECT ANALYSIS — Grade Distribution & Gender Performance');
    const subHead  = [['Subject','Count','Mean','High','Low', ...gradeKeys, 'Grade','♂ Mean','♀ Mean']];
    const subBody  = (exam?.subjectIds||[]).map(sid=>{
      const sub      = subjects.find(s=>s.id===sid); if(!sub) return null;
      const subMarks = examMarks.filter(m=>m.subjectId===sid);
      const vals     = subMarks.map(m=>m.score);
      if (!vals.length) return null;
      const mn       = vals.reduce((a,b)=>a+b,0)/vals.length;
      const dist     = {}; gradeKeys.forEach(g=>dist[g]=0);
      subMarks.forEach(m=>{const g=getGrade(m.score,sub.max);if(dist[g.grade]!==undefined)dist[g.grade]++;});
      const mV = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='M';}).map(m=>m.score);
      const fV = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='F';}).map(m=>m.score);
      const mMn = mV.length ? (mV.reduce((a,b)=>a+b,0)/mV.length).toFixed(1) : '—';
      const fMn = fV.length ? (fV.reduce((a,b)=>a+b,0)/fV.length).toFixed(1) : '—';
      const grd = getGrade(mn, sub.max);
      return [sub.name, vals.length, mn.toFixed(1), Math.max(...vals), Math.min(...vals),
              ...gradeKeys.map(g=>dist[g]||''), grd.grade, mMn, fMn];
    }).filter(Boolean);
    doc.autoTable({
      startY:34, head:subHead, body:subBody,
      theme:'striped', styles:{fontSize:8, cellPadding:2},
      headStyles:{fillColor:[22,163,74], textColor:255, fontStyle:'bold'},
      alternateRowStyles:{fillColor:[240,255,244]},
    });

    // ── Per-stream pages ──
    const examStreams = [...new Set(scored.map(s=>s.streamId))].map(sid=>streams.find(x=>x.id===sid)).filter(Boolean);
    examStreams.forEach(str => {
      doc.addPage();
      const strScored = buildMeritData(examId, str.id);
      addPageHeader(`STREAM MERIT LIST — ${str.name}`, `${strScored.length} students`);
      const sHead = [['#','Adm No','Name','G', ...examSubs.map(s=>s.code), 'Total','Mean','Grade','Pts']];
      const sBody = strScored.map(s=>{
        const subScores = examSubs.map(sub=>{
          const mk=examMarks.find(m=>m.studentId===s.id&&m.subjectId===sub.id);
          return mk ? String(mk.score) : '—';
        });
        return [s.overallRank, s.adm, s.name, s.gender, ...subScores, s.total, s.mean.toFixed(2), s.grade?.grade||'—', s.points];
      });
      doc.autoTable({
        startY:34, head:sHead, body:sBody,
        theme:'striped', styles:{fontSize:7, cellPadding:1.5},
        headStyles:{fillColor:[13,148,136], textColor:255, fontStyle:'bold', fontSize:7},
        alternateRowStyles:{fillColor:[240,253,250]},
      });

      // Stream subject analysis
      const strStudentIds = strScored.map(s=>s.id);
      const strSubBody = (exam?.subjectIds||[]).map(sid=>{
        const sub = subjects.find(s=>s.id===sid); if(!sub) return null;
        const subMarks = examMarks.filter(m=>m.subjectId===sid && strStudentIds.includes(m.studentId));
        if (!subMarks.length) return null;
        const vals = subMarks.map(m=>m.score);
        const mn   = vals.reduce((a,b)=>a+b,0)/vals.length;
        const dist = {}; gradeKeys.forEach(g=>dist[g]=0);
        subMarks.forEach(m=>{const g=getGrade(m.score,sub.max);if(dist[g.grade]!==undefined)dist[g.grade]++;});
        const mV = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='M';}).map(m=>m.score);
        const fV = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='F';}).map(m=>m.score);
        return [sub.name, vals.length, mn.toFixed(1), Math.max(...vals), Math.min(...vals),
                ...gradeKeys.map(g=>dist[g]||''), getGrade(mn,sub.max).grade,
                mV.length?(mV.reduce((a,b)=>a+b,0)/mV.length).toFixed(1):'—',
                fV.length?(fV.reduce((a,b)=>a+b,0)/fV.length).toFixed(1):'—'];
      }).filter(Boolean);
      const lastY = (doc.lastAutoTable?.finalY||34)+8;
      doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(13,148,136);
      doc.text(`Subject Analysis — ${str.name}`, 14, lastY);
      doc.setTextColor(0,0,0);
      doc.autoTable({
        startY:lastY+4, head:[['Subject','Count','Mean','High','Low', ...gradeKeys, 'Grade','♂','♀']],
        body: strSubBody,
        theme:'striped', styles:{fontSize:7.5, cellPadding:2},
        headStyles:{fillColor:[13,148,136], textColor:255, fontStyle:'bold', fontSize:7},
        alternateRowStyles:{fillColor:[240,253,250]},
      });
    });

    // Page numbers
    const total = doc.internal.getNumberOfPages();
    for (let i=1; i<=total; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(150,150,150);
      doc.text(`Page ${i} of ${total}`, PW-10, doc.internal.pageSize.getHeight()-5, {align:'right'});
      doc.text('Generated by Charanas Analyzer', 14, doc.internal.pageSize.getHeight()-5);
    }

    doc.save(`merit_list_${exam?.name||'exam'}.pdf`);
    showToast('Merit list PDF exported ✓','success');
  } catch(err) {
    showToast('PDF export failed: ' + err.message, 'error');
    console.error(err);
  }
}

// ─── SUBJECT ANALYSIS TAB ────────────────────────────────────
function renderSubjectAnalysis() {
  const examId = document.getElementById('saExam').value;
  const res    = document.getElementById('saResults');
  if (!examId) { res.innerHTML='<p style="color:var(--muted)">Select an exam above.</p>'; return; }
  const exam   = exams.find(e=>e.id===examId);
  const examMarks = marks.filter(m=>m.examId===examId);
  if (!examMarks.length) { res.innerHTML='<p style="color:var(--muted)">No marks entered for this exam.</p>'; return; }
  const gs         = getActiveGradingSystem();
  const gradeKeys  = gs.bands.map(b=>b.grade);

  const subRows = (exam?.subjectIds||[]).map(sid=>{
    const sub      = subjects.find(s=>s.id===sid); if(!sub) return '';
    const subMarks = examMarks.filter(m=>m.subjectId===sid);
    if (!subMarks.length) return '';
    const vals     = subMarks.map(m=>m.score);
    const mn       = vals.reduce((a,b)=>a+b,0)/vals.length;
    const mx       = Math.max(...vals);
    const lo       = Math.min(...vals);
    const dist     = {}; gradeKeys.forEach(g=>dist[g]=0);
    subMarks.forEach(m=>{const g=getGrade(m.score,sub.max);if(dist[g.grade]!==undefined)dist[g.grade]++;});
    const mV = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='M';}).map(m=>m.score);
    const fV = subMarks.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='F';}).map(m=>m.score);
    const mMn = mV.length ? (mV.reduce((a,b)=>a+b,0)/mV.length).toFixed(1) : '—';
    const fMn = fV.length ? (fV.reduce((a,b)=>a+b,0)/fV.length).toFixed(1) : '—';
    const grd  = getGrade(mn, sub.max);
    const distCells = gradeKeys.map(g=>`<td style="text-align:center">${dist[g]||''}</td>`).join('');
    return `<tr>
      <td><strong>${sub.name}</strong> <span class="badge b-blue" style="font-size:.65rem">${sub.code}</span></td>
      <td>${vals.length}</td>
      <td><strong style="color:var(--primary)">${mn.toFixed(1)}</strong></td>
      <td><span class="badge b-green">${mx}</span></td>
      <td><span class="badge b-red">${lo}</span></td>
      ${distCells}
      <td style="text-align:center"><span class="badge ${grd.cls}">${grd.grade}</span></td>
      <td style="text-align:center"><strong>${mMn}</strong></td>
      <td style="text-align:center"><strong>${fMn}</strong></td>
    </tr>`;
  }).join('');

  const gradeHeaders = gradeKeys.map(g=>`<th style="text-align:center;font-size:.7rem;min-width:36px">${g}</th>`).join('');

  res.innerHTML = `
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th rowspan="2">Subject</th>
              <th rowspan="2">Entries</th>
              <th rowspan="2">Mean</th>
              <th rowspan="2">Highest</th>
              <th rowspan="2">Lowest</th>
              <th colspan="${gradeKeys.length}" style="text-align:center;background:var(--primary-lt);color:var(--primary)">Grade Distribution (No. of Students)</th>
              <th rowspan="2">Grade</th>
              <th rowspan="2" style="text-align:center">♂ Mean</th>
              <th rowspan="2" style="text-align:center">♀ Mean</th>
            </tr>
            <tr>${gradeHeaders}</tr>
          </thead>
          <tbody>${subRows||'<tr><td colspan="20" style="text-align:center;color:var(--muted);padding:1.5rem">No data</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ═══════════════ STUDENTS CRUD ═══════════════
function renderStudents(filter='', genderFilter='') {
  let list = filter ? students.filter(s=>s.name.toLowerCase().includes(filter)||s.adm.includes(filter)) : [...students];
  if (genderFilter) list=list.filter(s=>s.gender===genderFilter);
  // Apply column sort
  const sc=sortState.students.col, sd=sortState.students.dir;
  list.sort((a,b)=>{
    let va,vb;
    if(sc==='class'){va=classes.find(c=>c.id===a.classId)?.name||'';vb=classes.find(c=>c.id===b.classId)?.name||'';}
    else if(sc==='stream'){va=streams.find(s=>s.id===a.streamId)?.name||'';vb=streams.find(s=>s.id===b.streamId)?.name||'';}
    else{va=a[sc]||'';vb=b[sc]||'';}
    va=String(va).toLowerCase();vb=String(vb).toLowerCase();
    return sd==='asc'?va.localeCompare(vb):vb.localeCompare(va);
  });
  // Inject sortable header row
  const stuThead=document.querySelector('#stuTbl thead tr');
  if(stuThead) stuThead.innerHTML=
    '<th><input type="checkbox" id="stuSelectAll" onchange="toggleSelectAllStudents(this)" title="Select all"/></th><th>#</th>'+
    thSort('students','adm','Adm No')+
    thSort('students','name','Name')+
    thSort('students','gender','Gender')+
    thSort('students','class','Class')+
    thSort('students','stream','Stream')+
    thSort('students','parent','Parent')+
    thSort('students','contact','Contact')+
    '<th>Subjects</th><th>Actions</th>';
  document.getElementById('stuBody').innerHTML = list.map((s,i)=>{
    const cls   = classes.find(c=>c.id===s.classId);
    const str   = streams.find(st=>st.id===s.streamId);
    const subs  = (s.subjectIds||[]).map(sid=>{ const sub=subjects.find(x=>x.id===sid); return sub?`<span class="badge b-teal" style="font-size:.65rem">${sub.code}</span>`:''; }).join(' ');
    const _isT  = currentUser && currentUser.role === 'teacher';
    return `<tr>
      <td>${_isT ? '' : `<input type="checkbox" class="stu-sel-chk" data-id="${s.id}" onchange="onStuSelChange()"/>`}</td>
      <td>${i+1}</td>
      <td style="font-family:var(--mono);font-size:.8rem">${s.adm}</td>
      <td><strong>${s.name}</strong></td>
      <td><span class="badge ${s.gender==='M'?'b-m':'b-f'}">${s.gender==='M'?'Male':'Female'}</span></td>
      <td>${cls?.name||'—'}</td><td>${str?.name||'—'}</td>
      <td>${s.parent||'—'}</td><td>${s.contact||'—'}</td>
      <td style="max-width:150px;overflow:hidden">${subs||'—'}</td>
      <td><div class="act-cell">
        ${_isT ? '' : `<button class="icb ed" onclick="editStudent('${s.id}')" title="Edit">✏️</button>`}
        ${_isT ? '' : `<button class="icb dl" onclick="deleteStudent('${s.id}')" title="Delete">🗑️</button>`}
        <button class="icb" style="background:var(--purple,#7c3aed);color:#fff;border:none" title="View Analytics" onclick="showStudentAnalytics('${s.id}')">📊</button>
      </div></td>
    </tr>`;
  }).join('') || `<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:1.5rem">No students yet.</td></tr>`;
  const saChk = document.getElementById('stuSelectAll');
  if (saChk) { saChk.checked = false; saChk.indeterminate = false; }
  updateBulkDeleteUI();
}

function filterStudentsGender(g) { renderStudents('',g); }

function onStuSelChange() {
  const all  = document.querySelectorAll('.stu-sel-chk');
  const chkd = document.querySelectorAll('.stu-sel-chk:checked');
  const sa   = document.getElementById('stuSelectAll');
  if (sa) { sa.checked = chkd.length===all.length && all.length>0; sa.indeterminate = chkd.length>0 && chkd.length<all.length; }
  updateBulkDeleteUI();
}

function toggleSelectAllStudents(cb) {
  document.querySelectorAll('.stu-sel-chk').forEach(c=>c.checked=cb.checked);
  updateBulkDeleteUI();
}

function updateBulkDeleteUI() {
  const chkd = document.querySelectorAll('.stu-sel-chk:checked');
  const btn  = document.getElementById('stuBulkDelBtn');
  const cnt  = document.getElementById('stuSelCount');
  if (btn)  btn.style.display = chkd.length>0 ? '' : 'none';
  if (cnt)  cnt.textContent   = chkd.length;
}

function deleteSelectedStudents() {
  const ids = [...document.querySelectorAll('.stu-sel-chk:checked')].map(c=>c.dataset.id);
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} selected student(s) and all their marks? This cannot be undone.`)) return;
  ids.forEach(id=>{
    students = students.filter(s=>s.id!==id);
    marks    = marks.filter(m=>m.studentId!==id);
    subjects.forEach(sub=>{ sub.studentIds=(sub.studentIds||[]).filter(x=>x!==id); });
  });
  save(K.students,students); save(K.marks,marks); save(K.subjects,subjects);
  renderStudents(); renderDashboard(); populateAllDropdowns();
  showToast(`${ids.length} student(s) deleted`,'info');
}


// ═══════════════ STUDENT ANALYTICS MODAL ═══════════════
function showStudentAnalytics(stuId) {
  const stu = students.find(s=>s.id===stuId); if(!stu) return;
  const cls = classes.find(c=>c.id===stu.classId);
  const stream = streams.find(s=>s.id===stu.streamId);

  // Build per-exam data
  const examData = exams.map(ex => {
    const exMarks = marks.filter(m=>m.examId===ex.id&&m.studentId===stuId);
    if (!exMarks.length) return null;
    const total = exMarks.reduce((a,m)=>a+m.score,0);
    const mean  = ex.subjectIds.length ? total/ex.subjectIds.length : 0;
    const subMax = subjects.filter(s=>ex.subjectIds.includes(s.id)).reduce((a,s)=>a+(s.max||100),0)/(ex.subjectIds.length||1);
    const g = getMeanGrade(mean/subMax*8);
    // Stream rank
    const strStudents = students.filter(s=>s.streamId===stu.streamId).map(s=>{
      const tm=marks.filter(m=>m.examId===ex.id&&m.studentId===s.id).reduce((a,m)=>a+m.score,0);
      return {id:s.id,total:tm};
    }).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);
    const streamRank = strStudents.findIndex(s=>s.id===stuId)+1;
    // Overall rank
    const allTotals = students.map(s=>{
      const tm=marks.filter(m=>m.examId===ex.id&&m.studentId===s.id).reduce((a,m)=>a+m.score,0);
      return {id:s.id,total:tm};
    }).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);
    const overallRank = allTotals.findIndex(s=>s.id===stuId)+1;
    // Subject rows
    const subRows = ex.subjectIds.map(sid=>{
      const sub=subjects.find(s=>s.id===sid); if(!sub) return null;
      const mk=exMarks.find(m=>m.subjectId===sid);
      const score=mk?mk.score:null;
      const gr=score!==null?getGrade(score,sub.max):null;
      return {name:sub.name,code:sub.code,max:sub.max,score,grade:gr?.grade||'—',points:gr?.points||'—'};
    }).filter(Boolean);
    return {exam:ex,total,mean:parseFloat(mean.toFixed(2)),grade:g.grade,label:g.label,streamRank,overallRank,subRows};
  }).filter(Boolean);

  const hasData = examData.length > 0;
  const chartId = 'saModalChart_'+stuId;

  const examCards = examData.map((d,i)=>`
    <div style="border:1px solid var(--border);border-radius:8px;padding:.75rem;margin-bottom:.75rem;background:var(--surface)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem;flex-wrap:wrap;gap:.3rem">
        <strong style="font-size:.9rem">${d.exam.name}</strong>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          <span class="badge b-blue" style="font-size:.65rem">Mean: ${d.mean}</span>
          <span class="badge b-green" style="font-size:.65rem">Grade: ${d.grade}</span>
          <span class="badge b-teal" style="font-size:.65rem">Stream #${d.streamRank}</span>
          <span class="badge b-amber" style="font-size:.65rem">Overall #${d.overallRank}</span>
        </div>
      </div>
      <table style="width:100%;font-size:.78rem;border-collapse:collapse">
        <thead><tr style="background:var(--border-lt)"><th style="text-align:left;padding:.25rem .4rem">Subject</th><th style="text-align:center;padding:.25rem .4rem">Score</th><th style="text-align:center;padding:.25rem .4rem">Out Of</th><th style="text-align:center;padding:.25rem .4rem">Grade</th><th style="text-align:center;padding:.25rem .4rem">Pts</th></tr></thead>
        <tbody>${d.subRows.map(r=>`<tr><td style="padding:.2rem .4rem">${r.name}</td><td style="text-align:center;font-weight:600;color:${r.score!==null?(r.score/r.max>=0.6?'var(--secondary)':r.score/r.max>=0.4?'var(--amber)':'var(--danger)'):'var(--muted)'}">${r.score!==null?r.score:'—'}</td><td style="text-align:center;color:var(--muted)">${r.max}</td><td style="text-align:center"><strong>${r.grade}</strong></td><td style="text-align:center">${r.points}</td></tr>`).join('')}</tbody>
      </table>
    </div>`).join('');

  showModal(
    `📊 Analytics — ${stu.name} (${stu.adm})`,
    `<div style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem">${cls?.name||''}${stream?' · '+stream.name+' Stream':''} · ${stu.gender==='M'?'Male':'Female'}</div>
    ${!hasData?'<p style="color:var(--muted);text-align:center;padding:2rem">No exam data found for this student.</p>':''}
    ${hasData && examData.length > 1 ? `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:.75rem;margin-bottom:1rem">
      <div style="font-weight:700;font-size:.85rem;margin-bottom:.5rem;color:var(--primary)">📈 Performance Trend</div>
      <canvas id="${chartId}" height="90"></canvas>
    </div>` : ''}
    ${examCards}`,
    [{label:'Close', cls:'btn-outline', action:'closeModal()'}]
  );

  // Draw chart after modal renders
  if (hasData && examData.length > 1) {
    setTimeout(() => {
      const ctx = document.getElementById(chartId); if (!ctx) return;
      new Chart(ctx, {
        type:'line',
        data:{
          labels: examData.map(d=>d.exam.name),
          datasets:[
            {label:'Mean Score',data:examData.map(d=>d.mean),borderColor:'#1a6fb5',backgroundColor:'rgba(26,111,181,0.1)',tension:0.4,fill:true,pointRadius:5,pointBackgroundColor:'#1a6fb5'},
            {label:'Stream Rank',data:examData.map(d=>d.streamRank),borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,0.05)',tension:0.4,fill:false,pointRadius:4,pointBackgroundColor:'#16a34a',yAxisID:'y2'}
          ]
        },
        options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',labels:{font:{size:10}}}},scales:{y:{beginAtZero:false,title:{display:true,text:'Mean Score',font:{size:9}}},y2:{type:'linear',display:true,position:'right',reverse:true,title:{display:true,text:'Stream Rank (lower=better)',font:{size:9}},grid:{drawOnChartArea:false}}}}
      });
    }, 120);
  }
}

function renderStudentSubjectCheckboxes() {
  const wrap = document.getElementById('stuSubjectsCheckboxes');
  if (!wrap) return;
  wrap.innerHTML = subjects.map(s=>`
    <label class="sub-check-label">
      <input type="checkbox" value="${s.id}" class="sub-chk" onchange="updateSelectAllCheckbox()"/>
      <span class="sub-chk-code badge b-teal" style="font-size:.65rem">${s.code}</span>
      <span class="sub-chk-name">${s.name}</span>
    </label>`).join('');
}
function toggleSelectAllSubjects(cb) {
  document.querySelectorAll('#stuSubjectsCheckboxes input[type=checkbox]').forEach(c=>c.checked=cb.checked);
}

function enrollStudentInStreamSubjects() {
  // Pre-check subjects that are assigned to the currently selected stream
  const streamId = document.getElementById('stuStream').value;
  if (!streamId) { showToast('Select a stream first','warning'); return; }
  // Get subjects with assignments for this stream
  const assignedSubIds = streamAssignments.filter(a=>a.streamId===streamId).map(a=>a.subjectId);
  if (!assignedSubIds.length) {
    showToast('No subject assignments configured for this stream. Set them up in Classes & Streams → Manage.','info');
    return;
  }
  document.querySelectorAll('#stuSubjectsCheckboxes input[type=checkbox]').forEach(cb=>{
    cb.checked = assignedSubIds.includes(cb.value);
  });
  updateSelectAllCheckbox();
  showToast(`${assignedSubIds.length} subjects pre-selected based on stream assignments ✓`,'success');
}
function updateSelectAllCheckbox() {
  const all = document.querySelectorAll('#stuSubjectsCheckboxes input[type=checkbox]');
  const checked = document.querySelectorAll('#stuSubjectsCheckboxes input[type=checkbox]:checked');
  const sa = document.getElementById('stuSelectAll');
  if (sa) { sa.checked = all.length>0 && checked.length===all.length; sa.indeterminate = checked.length>0 && checked.length<all.length; }
}

function saveStudent() {
  if (currentUser && currentUser.role === 'teacher') { showToast('Teachers cannot add or edit students','error'); return; }
  const adm     = document.getElementById('stuAdm').value.trim();
  const name    = document.getElementById('stuName').value.trim();
  const gender  = document.getElementById('stuGender').value;
  const classId = document.getElementById('stuClass').value;
  const streamId= document.getElementById('stuStream').value;
  const parent  = document.getElementById('stuParent').value.trim();
  const contact = document.getElementById('stuContact').value.trim();
  const dob     = document.getElementById('stuDOB').value;
  const notes   = document.getElementById('stuNotes').value;
  // All subjects apply to all students
  const subIds = subjects.map(s => s.id);
  if (!adm||!name||!classId||!streamId) { showToast('Adm No, Name, Class and Stream are required','error'); return; }
  const editId = document.getElementById('editStuId').value;
  if (editId) {
    const i=students.findIndex(s=>s.id===editId);
    if(i>-1) students[i]={...students[i],adm,name,gender,classId,streamId,parent,contact,dob,notes,subjectIds:subIds};
    showToast('Student updated ✓','success');
  } else {
    if(students.find(s=>s.adm===adm)){showToast('Admission number exists','error');return;}
    const stu={id:uid(),adm,name,gender,classId,streamId,parent,contact,dob,notes,subjectIds:subIds};
    students.push(stu);
    // Enrol in all subjects
    subIds.forEach(sid=>{const sub=subjects.find(x=>x.id===sid);if(sub&&!sub.studentIds.includes(stu.id))sub.studentIds.push(stu.id);});
    save(K.subjects,subjects);
    showToast('Student added ✓','success');
  }
  save(K.students,students); cancelStuEdit(); renderStudents(); renderDashboard(); populateAllDropdowns();
}

function editStudent(id) {
  if (currentUser && currentUser.role === 'teacher') { showToast('Teachers cannot edit students','error'); return; }
  const s=students.find(x=>x.id===id); if(!s) return;
  document.getElementById('editStuId').value=s.id;
  document.getElementById('stuAdm').value=s.adm;
  document.getElementById('stuName').value=s.name;
  document.getElementById('stuGender').value=s.gender;
  document.getElementById('stuClass').value=s.classId;
  updateStuStreamDropdown();
  document.getElementById('stuStream').value=s.streamId;
  document.getElementById('stuParent').value=s.parent||'';
  document.getElementById('stuContact').value=s.contact||'';
  document.getElementById('stuDOB').value=s.dob||'';
  document.getElementById('stuNotes').value=s.notes||'';
  document.querySelectorAll('#stuSubjectsCheckboxes input[type=checkbox]').forEach(cb=>{cb.checked=(s.subjectIds||[]).includes(cb.value);});
  updateSelectAllCheckbox();
  document.getElementById('stuFormTitle').textContent='✏️ Edit Student';
  document.getElementById('stuAdm').scrollIntoView({behavior:'smooth',block:'center'});
}

function cancelStuEdit() {
  ['editStuId','stuAdm','stuName','stuParent','stuContact','stuDOB','stuNotes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('stuGender').value='M';
  document.getElementById('stuFormTitle').textContent='➕ Add Student';
}

function deleteStudent(id) {
  if (currentUser && currentUser.role === 'teacher') { showToast('Teachers cannot delete students','error'); return; }
  if(!confirm('Delete student and their marks?')) return;
  students=students.filter(s=>s.id!==id);
  marks=marks.filter(m=>m.studentId!==id);
  subjects.forEach(sub=>{sub.studentIds=(sub.studentIds||[]).filter(x=>x!==id);});
  save(K.students,students); save(K.marks,marks); save(K.subjects,subjects);
  renderStudents(); renderDashboard(); showToast('Student deleted','info');
}

// Student Excel upload
function showStudentUpload() {
  const card=document.getElementById('stuUploadCard');
  card.style.display=card.style.display==='none'?'':'none';
}

function handleStudentUpload(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const wb=XLSX.read(e.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(ws);
      let added=0, skipped=0;
      data.forEach(row=>{
        const adm    =String(row['AdmNo']||row['admno']||row['Adm No']||'').trim();
        const name   =String(row['Name']||row['name']||'').trim();
        const gender =(String(row['Gender']||row['gender']||'M')).trim().toUpperCase().startsWith('F')?'F':'M';
        const clsName=String(row['Class']||row['class']||'').trim();
        const strName=String(row['Stream']||row['stream']||'').trim();
        const contact=String(row['ParentContact']||row['parent_contact']||'').trim();
        const parent =String(row['ParentName']||row['parent_name']||'').trim();
        if(!adm||!name){skipped++;return;}
        if(students.find(s=>s.adm===adm)){skipped++;return;}
        const cls=classes.find(c=>c.name.toLowerCase()===clsName.toLowerCase());
        // Match stream by name AND classId so "East" in Grade 7 ≠ "East" in Grade 8
        const str=streams.find(s=>s.name.toLowerCase()===strName.toLowerCase()&&(!cls||s.classId===cls.id))
               || (strName ? streams.find(s=>s.name.toLowerCase()===strName.toLowerCase()) : null);
        const stu={id:uid(),adm,name,gender,classId:cls?.id||'',streamId:str?.id||'',parent,contact,dob:'',notes:'',subjectIds:subjects.map(s=>s.id)};
        students.push(stu);
        subjects.forEach(sub=>{if(!sub.studentIds.includes(stu.id))sub.studentIds.push(stu.id);});
        added++;
      });
      save(K.students,students); save(K.subjects,subjects);
      renderStudents(); populateAllDropdowns(); renderDashboard();
      showToast(`${added} students added, ${skipped} skipped ✓`,'success');
    } catch(err){showToast('Error reading file','error');console.error(err);}
  };
  reader.readAsArrayBuffer(file); input.value='';
}

function downloadStudentTemplate() {
  const data=[{AdmNo:'',Name:'',Gender:'',Class:'',Stream:'',ParentName:'',ParentContact:''}];
  const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Students');
  XLSX.writeFile(wb,'students_template.xlsx');
}

function exportStudentsExcel() {
  const data=students.map(s=>{
    const cls=classes.find(c=>c.id===s.classId); const str=streams.find(x=>x.id===s.streamId);
    return { AdmNo:s.adm,Name:s.name,Gender:s.gender,Class:cls?.name||'',Stream:str?.name||'',ParentName:s.parent,Contact:s.contact };
  });
  const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Students');
  XLSX.writeFile(wb,'students_list.xlsx');
}

// ═══════════════ TEACHERS CRUD ═══════════════
function renderTeachers() {
  const sc=sortState.teachers.col, sd=sortState.teachers.dir;
  const list=[...teachers].sort((a,b)=>{
    let va=a[sc]||'', vb=b[sc]||'';
    va=String(va).toLowerCase(); vb=String(vb).toLowerCase();
    return sd==='asc'?va.localeCompare(vb):vb.localeCompare(va);
  });
  const tchThead=document.querySelector('#tchTbl thead tr');
  if(tchThead) tchThead.innerHTML='<th>#</th>'+
    thSort('teachers','name','Name')+
    thSort('teachers','phone','Phone')+
    thSort('teachers','email','Email')+
    '<th>Subjects</th>'+
    thSort('teachers','classes','Classes')+
    thSort('teachers','username','Username')+
    '<th>Rights</th><th>Actions</th>';
  document.getElementById('tchBody').innerHTML = list.map((t,i)=>{
    const allSubIds = getTeacherSubjectIds(t.id);
    const subs = allSubIds.map(sid=>{
      const sub=subjects.find(x=>x.id===sid);
      if (!sub) return '';
      return `<span class="tch-sub-tag" style="display:inline-flex;align-items:center;gap:2px;background:var(--blue-lt);border:1px solid var(--border);border-radius:12px;padding:1px 6px 1px 8px;font-size:.65rem;margin:2px">
        ${sub.code}
        <button onclick="removeSubjectFromTeacher('${t.id}','${sub.id}')" title="Remove ${sub.name}" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:.75rem;line-height:1;padding:0 0 0 2px" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--muted)'">✕</button>
      </span>`;
    }).join('');
    const rights=[t.canAnalyse?'Analysis':'',t.canReport?'Reports':'',t.canMerit?'Merit':''].filter(Boolean).join(', ');
    return `<tr>
      <td>${i+1}</td><td><div style="display:flex;align-items:center;gap:.5rem">${teacherInitialsTag(t)}<strong>${t.name}</strong></div></td>
      <td>${t.phone}</td><td>${t.email||'—'}</td>
      <td style="max-width:200px"><div style="display:flex;flex-wrap:wrap;gap:2px">${subs||'<span style="color:var(--muted);font-size:.78rem">None</span>'}</div></td>
      <td>${t.classes||'—'}</td>
      <td style="font-family:var(--mono);font-size:.8rem">${t.username||'—'}</td>
      <td>${rights?`<span class="badge b-green" style="font-size:.65rem">${rights}</span>`:'—'}</td>
      <td><div class="act-cell">
        <button class="icb ed" onclick="editTeacher('${t.id}')" title="Edit">✏️</button>
        <button class="icb dl" onclick="deleteTeacher('${t.id}')" title="Delete">🗑️</button>
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:1.5rem">No teachers yet.</td></tr>';
}

function removeSubjectFromTeacher(teacherId, subjectId) {
  // Remove from stream assignments
  streamAssignments = streamAssignments.filter(a => !(a.teacherId === teacherId && a.subjectId === subjectId));
  saveStreamAssignments();
  // Remove from subject default teacher
  const sub = subjects.find(s => s.id === subjectId);
  if (sub && sub.teacherId === teacherId) { sub.teacherId = ''; save(K.subjects, subjects); }
  // Remove from teacher's subjectIds
  const t = teachers.find(x => x.id === teacherId);
  if (t) { t.subjectIds = (t.subjectIds || []).filter(x => x !== subjectId); save(K.teachers, teachers); }
  renderTeachers(); renderSubjects();
  showToast('Subject removed from teacher ✓', 'info');
}

function saveTeacher() {
  const name  = document.getElementById('tchName').value.trim();
  const phone = document.getElementById('tchPhone').value.trim();
  const email = document.getElementById('tchEmail').value.trim();
  const user  = document.getElementById('tchUser').value.trim();
  const passEl= document.getElementById('tchPass');
  const pass  = passEl ? passEl.value : '';
  const cls   = document.getElementById('tchClasses').value.trim();
  const qualEl= document.getElementById('tchQual');
  const qual  = qualEl ? qualEl.value.trim() : '';
  if (!name || !phone) { showToast('Name and phone are required','error'); return; }
  const editId = document.getElementById('editTchId').value;
  // Rights are managed in Settings > Teacher Access Manager — preserve existing rights when editing
  const existingTeacher = editId ? teachers.find(t => t.id === editId) : null;
  const canAn = existingTeacher ? !!existingTeacher.canAnalyse : false;
  const canRp = existingTeacher ? !!existingTeacher.canReport  : false;
  const canMr = existingTeacher ? !!existingTeacher.canMerit   : false;
  const obj = { name, phone, email, username:user, password:pass, classes:cls, qual, canAnalyse:canAn, canReport:canRp, canMerit:canMr };
  if (editId) {
    const i = teachers.findIndex(t => t.id === editId);
    if (i > -1) {
      if (!pass) delete obj.password;
      // Preserve existing subjectIds from stream assignments
      teachers[i] = { ...teachers[i], ...obj };
    }
    showToast('Teacher updated ✓','success');
  } else {
    teachers.push({ id:uid(), subjectIds:[], ...obj });
    showToast('Teacher added ✓','success');
  }
  save(K.teachers, teachers);
  cancelTchEdit();
  renderTeachers();
  populateAllDropdowns();
  renderDashboard();
}

function editTeacher(id) {
  const t=teachers.find(x=>x.id===id); if(!t) return;
  document.getElementById('editTchId').value=t.id;
  document.getElementById('tchName').value=t.name;
  document.getElementById('tchPhone').value=t.phone;
  document.getElementById('tchEmail').value=t.email||'';
  document.getElementById('tchUser').value=t.username||'';
  document.getElementById('tchPass').value=t.password||'';
  document.getElementById('tchClasses').value=t.classes||'';
  // Rights are read-only here (managed in Settings) — no UI to update
  document.getElementById('tchFormTitle').textContent='✏️ Edit Teacher';
  document.getElementById('tchName').scrollIntoView({behavior:'smooth',block:'center'});
}

function cancelTchEdit() {
  ['editTchId','tchName','tchPhone','tchEmail','tchUser','tchPass','tchClasses'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('tchFormTitle').textContent='➕ Add Teacher';
}

function deleteTeacher(id) {
  if(!confirm('Delete this teacher?')) return;
  teachers=teachers.filter(t=>t.id!==id);
  save(K.teachers,teachers); renderTeachers(); renderDashboard(); showToast('Teacher deleted','info');
}

// ═══════════════ SUBJECTS CRUD ═══════════════
function renderSubjects() {
  const sc=sortState.subjects.col, sd=sortState.subjects.dir;
  const list=[...subjects].sort((a,b)=>{
    let va,vb;
    if(sc==='teacher'){va=teachers.find(t=>t.id===a.teacherId)?.name||'';vb=teachers.find(t=>t.id===b.teacherId)?.name||'';}
    else if(sc==='enrolled'){va=(a.studentIds||[]).length;vb=(b.studentIds||[]).length;return sd==='asc'?va-vb:vb-va;}
    else if(sc==='max'){va=parseFloat(a.max||0);vb=parseFloat(b.max||0);return sd==='asc'?va-vb:vb-va;}
    else{va=a[sc]||'';vb=b[sc]||'';}
    va=String(va).toLowerCase();vb=String(vb).toLowerCase();
    return sd==='asc'?va.localeCompare(vb):vb.localeCompare(va);
  });
  const subThead=document.querySelector('#subTbl thead tr');
  if(subThead) subThead.innerHTML='<th>#</th>'+
    thSort('subjects','name','Name')+
    thSort('subjects','code','Code')+
    thSort('subjects','max','Max')+
    thSort('subjects','category','Category')+
    thSort('subjects','teacher','Teacher')+
    thSort('subjects','enrolled','Enrolled Students')+
    '<th>Actions</th>';
  document.getElementById('subBody').innerHTML=list.map((s,i)=>{
    const tch=teachers.find(t=>t.id===s.teacherId);
    return `<tr>
      <td>${i+1}</td><td><strong>${s.name}</strong></td>
      <td><span class="badge b-blue">${s.code}</span></td>
      <td>${s.max}</td>
      <td><span class="badge ${s.category==='Core'?'b-green':s.category==='Technical'?'b-amber':s.category==='Languages'?'b-teal':'b-purple'}">${s.category}</span></td>
      <td>${tch?`<div style="display:flex;align-items:center;gap:.5rem">${teacherInitialsTag(tch)}<span>${tch.name}</span></div>`:'—'}</td>
      <td>${(s.studentIds||[]).length} students</td>
      <td><div class="act-cell">
        <button class="icb ed" onclick="editSubject('${s.id}')" title="Edit">✏️</button>
        <button class="icb dl" onclick="deleteSubject('${s.id}')" title="Delete">🗑️</button>
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:1.5rem">No subjects yet.</td></tr>';
}

function saveSubject() {
  const name  =document.getElementById('subName').value.trim();
  const code  =document.getElementById('subCode').value.trim().toUpperCase();
  const max   =parseInt(document.getElementById('subMax').value)||100;
  const cat   =document.getElementById('subCat').value;
  const tchId =document.getElementById('subTeacher').value;
  if(!name||!code){showToast('Name and code required','error');return;}
  const editId=document.getElementById('editSubId').value;
  if(editId){
    const i=subjects.findIndex(s=>s.id===editId);
    // Preserve existing studentIds
    if(i>-1)subjects[i]={...subjects[i],name,code,max,category:cat,teacherId:tchId};
    showToast('Subject updated ✓','success');
  } else {
    if(subjects.find(s=>s.code===code)){showToast('Code already exists','error');return;}
    // Auto-enrol all existing students in new subject
    const allStudentIds = students.map(s=>s.id);
    subjects.push({id:uid(),name,code,max,category:cat,teacherId:tchId,studentIds:allStudentIds});
    // Also update each student's subjectIds
    allStudentIds.forEach(sid=>{
      const stu=students.find(s=>s.id===sid);
      if(stu){const newSubId=subjects[subjects.length-1].id;if(!stu.subjectIds)stu.subjectIds=[];if(!stu.subjectIds.includes(newSubId))stu.subjectIds.push(newSubId);}
    });
    save(K.students,students);
    showToast('Subject added ✓','success');
  }
  save(K.subjects,subjects); cancelSubEdit(); renderSubjects(); populateAllDropdowns();
}

function editSubject(id) {
  const s=subjects.find(x=>x.id===id); if(!s) return;
  document.getElementById('editSubId').value=s.id;
  document.getElementById('subName').value=s.name;
  document.getElementById('subCode').value=s.code;
  document.getElementById('subMax').value=s.max;
  document.getElementById('subCat').value=s.category;
  document.getElementById('subTeacher').value=s.teacherId||'';
  document.getElementById('subFormTitle').textContent='✏️ Edit Subject';
  document.getElementById('subName').scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelSubEdit() {
  ['editSubId','subName','subCode'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('subMax').value='100';
  document.getElementById('subFormTitle').textContent='➕ Add Subject';
}
function deleteSubject(id) {
  if(!confirm('Delete this subject? Marks data for this subject will also be removed.')) return;
  subjects=subjects.filter(s=>s.id!==id);
  marks=marks.filter(m=>m.subjectId!==id);
  save(K.subjects,subjects); save(K.marks,marks);
  renderSubjects(); showToast('Subject deleted','info');
}

// ═══════════════ CLASSES & STREAMS ═══════════════
function renderClasses() {
  const sc=sortState.classes.col, sd=sortState.classes.dir;
  const list=[...classes].sort((a,b)=>{
    let va,vb;
    if(sc==='students'){va=students.filter(s=>s.classId===a.id).length;vb=students.filter(s=>s.classId===b.id).length;return sd==='asc'?va-vb:vb-va;}
    else{va=a[sc]||'';vb=b[sc]||'';}
    va=String(va).toLowerCase();vb=String(vb).toLowerCase();
    return sd==='asc'?va.localeCompare(vb):vb.localeCompare(va);
  });
  const clsThead=document.querySelector('#clsTbl thead tr');
  if(clsThead) clsThead.innerHTML='<th>#</th>'+
    thSort('classes','name','Class Name')+
    thSort('classes','level','Level')+
    thSort('classes','students','Students')+
    '<th>Actions</th>';
  document.getElementById('clsBody').innerHTML=list.map((c,i)=>{
    const cnt=students.filter(s=>s.classId===c.id).length;
    return `<tr><td>${i+1}</td><td><strong>${c.name}</strong></td><td>${c.level||'—'}</td><td>${cnt}</td>
      <td><div class="act-cell">
        <button class="icb ed" onclick="editClass('${c.id}')" title="Edit">✏️</button>
        <button class="icb dl" onclick="deleteClass('${c.id}')" title="Delete">🗑️</button>
        <button class="icb" style="background:var(--primary);color:#fff;border:none" onclick="manageClassStudents('${c.id}')" title="Manage Students">👥</button>
        <button class="icb" style="background:var(--secondary,#16a34a);color:#fff;border:none;font-size:.68rem;padding:.2rem .45rem;border-radius:5px" onclick="downloadClassList('${c.id}')" title="Download class student list">⬇</button>
      </div></td></tr>`;
  }).join('');
  const strCls=document.getElementById('strClass');
  if(strCls) strCls.innerHTML='<option value="">— Select Class —</option>'+classes.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}

function saveClass() {
  const name=document.getElementById('clsName').value.trim();
  const level=document.getElementById('clsLevel').value.trim();
  if(!name){showToast('Class name required','error');return;}
  const editId=document.getElementById('editClsId').value;
  if(editId){const i=classes.findIndex(c=>c.id===editId);if(i>-1)classes[i]={...classes[i],name,level};}
  else classes.push({id:uid(),name,level});
  save(K.classes,classes); cancelClsEdit(); renderClasses(); populateAllDropdowns();
  showToast('Class saved ✓','success');
}
function editClass(id){
  const c=classes.find(x=>x.id===id);if(!c)return;
  document.getElementById('editClsId').value=c.id;
  document.getElementById('clsName').value=c.name;
  document.getElementById('clsLevel').value=c.level||'';
  document.getElementById('clsFormTitle').textContent='✏️ Edit Class';
}
function manageClassStudents(classId){
  const cls=classes.find(c=>c.id===classId);if(!cls)return;
  const classStreams=streams.filter(s=>s.classId===classId);
  const classStudents=students.filter(s=>s.classId===classId);
  const allStudents=students;
  showModal('👥 Manage Class — '+cls.name,`
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:1rem">Students in this class: <strong>${classStudents.length}</strong></p>
    <div style="max-height:300px;overflow-y:auto">
      ${classStudents.map(s=>{
        const str=streams.find(x=>x.id===s.streamId);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--border-lt);font-size:.83rem">
          <div><strong>${s.name}</strong> <span style="color:var(--muted)">${s.adm}</span></div>
          <span class="badge b-teal" style="font-size:.65rem">${str?.name||'—'}</span>
        </div>`;
      }).join('')}
    </div>
    <p style="font-size:.78rem;color:var(--muted);margin-top:.75rem">To move or reassign students, edit the student record.</p>
  `,[{label:'Close',cls:'btn-outline',action:'closeModal()'}]);
}
function cancelClsEdit(){['editClsId','clsName','clsLevel'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('clsFormTitle').textContent='➕ Add Class';}
function deleteClass(id){if(!confirm('Delete class?'))return;classes=classes.filter(c=>c.id!==id);save(K.classes,classes);renderClasses();showToast('Class deleted','info');}

function renderStreams() {
  const sc=sortState.streams.col, sd=sortState.streams.dir;
  const list=[...streams].sort((a,b)=>{
    let va,vb;
    if(sc==='class'){va=classes.find(c=>c.id===a.classId)?.name||'';vb=classes.find(c=>c.id===b.classId)?.name||'';}
    else if(sc==='students'){va=students.filter(x=>x.streamId===a.id).length;vb=students.filter(x=>x.streamId===b.id).length;return sd==='asc'?va-vb:vb-va;}
    else if(sc==='teacher'){va=teachers.find(t=>t.id===a.streamTeacherId)?.name||'';vb=teachers.find(t=>t.id===b.streamTeacherId)?.name||'';}
    else{va=a[sc]||'';vb=b[sc]||'';}
    va=String(va).toLowerCase();vb=String(vb).toLowerCase();
    return sd==='asc'?va.localeCompare(vb):vb.localeCompare(va);
  });
  const strThead=document.querySelector('#strTbl thead tr');
  if(strThead) strThead.innerHTML='<th>#</th>'+
    thSort('streams','name','Stream')+
    thSort('streams','class','Class')+
    thSort('streams','students','Students')+
    thSort('streams','teacher','Class Teacher')+
    '<th>Subject Coverage</th><th>Actions</th>';
  document.getElementById('strBody').innerHTML=list.map((s,i)=>{
    const cls=classes.find(c=>c.id===s.classId);
    const cnt=students.filter(x=>x.streamId===s.id).length;
    const assignedCount = streamAssignments.filter(a=>a.streamId===s.id&&a.teacherId).length;
    const clsTeacher=teachers.find(t=>t.id===s.streamTeacherId);
    return `<tr><td>${i+1}</td><td><strong>${s.name}</strong></td><td>${cls?.name||'—'}</td><td>${cnt}</td>
      <td>${clsTeacher?`<div style="display:flex;align-items:center;gap:.4rem">${teacherInitialsTag(clsTeacher)}<span style="font-size:.82rem">${clsTeacher.name}</span></div>`:'<span style="color:var(--muted);font-size:.8rem">Not assigned</span>'}</td>
      <td>${assignedCount ? `<span class="badge b-green" style="font-size:.65rem">${assignedCount} subjects</span>` : '<span style="color:var(--muted);font-size:.75rem">Not configured</span>'}</td>
      <td><div class="act-cell">
        <button class="icb" style="background:var(--primary);color:#fff;border:none;padding:.2rem .5rem;font-size:.68rem;border-radius:5px;cursor:pointer" onclick="openManageStream('${s.id}')" title="Manage">⚙</button>
        <button class="icb ed" onclick="editStream('${s.id}')" title="Edit">✏️</button>
        <button class="icb dl" onclick="deleteStream('${s.id}')" title="Delete">🗑️</button>
        <button class="icb" style="background:var(--secondary,#16a34a);color:#fff;border:none;font-size:.68rem;padding:.2rem .45rem;border-radius:5px" onclick="downloadStreamList('${s.id}')" title="Download stream student list">⬇</button>
      </div></td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:1.5rem">No streams yet.</td></tr>';
}

function saveStream(){
  const name=document.getElementById('strName').value.trim();
  const classId=document.getElementById('strClass').value;
  const streamTeacherId=document.getElementById('strTeacher')?.value||'';
  if(!name){showToast('Stream name required','error');return;}
  const editId=document.getElementById('editStrId').value;
  if(editId){const i=streams.findIndex(s=>s.id===editId);if(i>-1)streams[i]={...streams[i],name,classId,streamTeacherId};}
  else streams.push({id:uid(),name,classId,streamTeacherId});
  save(K.streams,streams); cancelStrEdit(); renderStreams(); populateAllDropdowns();
  showToast('Stream saved ✓','success');
}
function editStream(id){
  const s=streams.find(x=>x.id===id);if(!s)return;
  document.getElementById('editStrId').value=s.id;
  document.getElementById('strName').value=s.name;
  document.getElementById('strClass').value=s.classId||'';
  populateStrTeacherDropdown();
  const strTch=document.getElementById('strTeacher');
  if(strTch) strTch.value=s.streamTeacherId||'';
  document.getElementById('strFormTitle').textContent='✏️ Edit Stream';
}
function populateStrTeacherDropdown(){
  const el=document.getElementById('strTeacher');if(!el)return;
  el.innerHTML='<option value="">— None —</option>'+teachers.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
}
function cancelStrEdit(){['editStrId','strName'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('strFormTitle').textContent='➕ Add Stream';}
function deleteStream(id){if(!confirm('Delete stream?'))return;streams=streams.filter(s=>s.id!==id);save(K.streams,streams);renderStreams();showToast('Stream deleted','info');}

// ═══════════════ STREAM SUBJECT-TEACHER ASSIGNMENTS ═══════════════
// streamAssignments: [{ id, streamId, subjectId, teacherId }]
let streamAssignments = [];
const K_SA = 'ei_streamassign';

function loadStreamAssignments() {
  streamAssignments = (() => { try { return JSON.parse(localStorage.getItem(K_SA)) || []; } catch { return []; } })();
}

function saveStreamAssignments() {
  localStorage.setItem(K_SA, JSON.stringify(streamAssignments));
}

function getStreamTeacher(streamId, subjectId) {
  // First check stream-specific assignment
  const sa = streamAssignments.find(a => a.streamId === streamId && a.subjectId === subjectId);
  if (sa && sa.teacherId) return teachers.find(t => t.id === sa.teacherId) || null;
  // Fall back to subject's default teacher
  const sub = subjects.find(s => s.id === subjectId);
  if (sub && sub.teacherId) return teachers.find(t => t.id === sub.teacherId) || null;
  return null;
}

function openManageStream(streamId) {
  const stream = streams.find(s => s.id === streamId);
  if (!stream) return;
  const cls = classes.find(c => c.id === stream.classId);

  const rows = subjects.map(sub => {
    const sa = streamAssignments.find(a => a.streamId === streamId && a.subjectId === sub.id);
    const assignedId = sa ? sa.teacherId : (sub.teacherId || '');
    const tOpts = '<option value="">— None —</option>' + 
      teachers.map(t => `<option value="${t.id}" ${t.id === assignedId ? 'selected' : ''}>${t.name}</option>`).join('');
    return `<tr>
      <td><span class="badge b-blue" style="font-size:.68rem">${sub.code}</span> <strong>${sub.name}</strong></td>
      <td>
        <select class="sa-teacher-sel" data-stream="${streamId}" data-subject="${sub.id}" style="width:100%;font-size:.82rem;padding:.3rem .5rem">
          ${tOpts}
        </select>
      </td>
      <td>
        <select class="sa-enroll-all" data-stream="${streamId}" data-subject="${sub.id}" style="width:100%;font-size:.82rem;padding:.3rem .5rem">
          <option value="">— Enroll action —</option>
          <option value="all">Enroll all stream students</option>
          <option value="none">Remove all stream students</option>
        </select>
      </td>
    </tr>`;
  }).join('');

  showModal(
    `📚 Manage Stream: ${stream.name}${cls ? ' — ' + cls.name : ''}`,
    `<p style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem">Assign teachers to subjects for this stream. Teachers will only see & upload marks for their assigned subjects.</p>
    <div class="tbl-wrap" style="max-height:400px;overflow-y:auto">
      <table>
        <thead><tr><th>Subject</th><th>Teacher for this Stream</th><th>Enrolment</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`,
    [{label:'💾 Save Assignments', cls:'btn-primary', action:"saveStreamAssignmentsFromModal('"+streamId+"')"},
     {label:'Close', cls:'btn-outline', action:'closeModal()'}]
  );
}

function saveStreamAssignmentsFromModal(streamId) {
  document.querySelectorAll('.sa-teacher-sel').forEach(sel => {
    const sid = sel.dataset.subject;
    const tid = sel.value;
    const existing = streamAssignments.findIndex(a => a.streamId === streamId && a.subjectId === sid);
    if (existing > -1) streamAssignments[existing].teacherId = tid;
    else streamAssignments.push({ id: uid(), streamId, subjectId: sid, teacherId: tid });
  });
  // Handle enrolment actions
  document.querySelectorAll('.sa-enroll-all').forEach(sel => {
    const sid = sel.dataset.subject;
    const action = sel.value;
    if (!action) return;
    const sub = subjects.find(s => s.id === sid);
    if (!sub) return;
    const streamStudentIds = students.filter(st => st.streamId === streamId).map(st => st.id);
    if (action === 'all') {
      streamStudentIds.forEach(stId => {
        if (!sub.studentIds.includes(stId)) sub.studentIds.push(stId);
        const stu = students.find(s => s.id === stId);
        if (stu && !(stu.subjectIds || []).includes(sid)) {
          if (!stu.subjectIds) stu.subjectIds = [];
          stu.subjectIds.push(sid);
        }
      });
    } else if (action === 'none') {
      sub.studentIds = sub.studentIds.filter(id => !streamStudentIds.includes(id));
      students.forEach(stu => {
        if (stu.streamId === streamId) {
          stu.subjectIds = (stu.subjectIds || []).filter(x => x !== sid);
        }
      });
    }
  });
  saveStreamAssignments();
  save(K.subjects, subjects);
  save(K.students, students);
  closeModal();
  showToast('Stream assignments saved ✓', 'success');
  // Update teacher subject list derived from assignments
  syncTeacherSubjectsFromAssignments();
}

function syncTeacherSubjectsFromAssignments() {
  // Each teacher's subjectIds = union of subjects assigned to them across all streams
  teachers.forEach(t => {
    const assignedSubs = streamAssignments.filter(a => a.teacherId === t.id).map(a => a.subjectId);
    // Also keep subjects directly assigned to teacher
    const directSubs = subjects.filter(s => s.teacherId === t.id).map(s => s.id);
    const allSubs = [...new Set([...assignedSubs, ...directSubs])];
    t.subjectIds = allSubs;
  });
  save(K.teachers, teachers);
  renderTeachers();
}

// ═══════════════ TEACHER: get subjects they are assigned to (stream or default) ═══════════════
// ═══════════════ TEACHER ROLE HELPERS ═══════════════
// Returns true if the current user is a class teacher of any stream
function currentUserIsClassTeacher() {
  if (!currentUser || currentUser.role !== 'teacher') return false;
  const tId = currentUser.teacherId;
  return streams.some(s => s.streamTeacherId === tId);
}
// Returns stream IDs where teacher is class teacher
function getClassTeacherStreamIds(teacherId) {
  return streams.filter(s => s.streamTeacherId === teacherId).map(s => s.id);
}

function getTeacherSubjectIds(teacherId) {
  // From stream assignments
  const fromStreams = streamAssignments.filter(a => a.teacherId === teacherId).map(a => a.subjectId);
  // From subject default teacher
  const fromDefault = subjects.filter(s => s.teacherId === teacherId).map(s => s.id);
  return [...new Set([...fromStreams, ...fromDefault])];
}


// ═══════════════ REPORT FORMS ═══════════════
function getStudentReport(stuId, examId) {
  const stu    = students.find(s=>s.id===stuId); if(!stu) return null;
  const exam   = exams.find(e=>e.id===examId);   if(!exam) return null;
  const cls    = classes.find(c=>c.id===stu.classId);
  const stream = streams.find(s=>s.id===stu.streamId);

  const isConsolidated = exam.category === 'consolidated';
  const sourceExamObjs = isConsolidated
    ? (exam.sourceExamIds||[]).map(id=>exams.find(e=>e.id===id)).filter(Boolean)
    : [];

  let subjectRows, total, mean, mGrade, totalPoints;

  if (isConsolidated && sourceExamObjs.length > 0) {
    // Compute each subject's score as the average across source exams
    subjectRows = exam.subjectIds.map(sid => {
      const sub = subjects.find(s=>s.id===sid); if(!sub) return null;
      const scores = sourceExamObjs.map(src => {
        const mk = marks.find(m=>m.examId===src.id&&m.studentId===stuId&&m.subjectId===sid);
        return mk ? mk.score : null;
      });
      const validScores = scores.filter(sc=>sc!==null);
      const avgScore = validScores.length > 0 ? parseFloat((validScores.reduce((a,b)=>a+b,0)/validScores.length).toFixed(1)) : null;
      const g = avgScore !== null ? getGrade(avgScore, sub.max) : null;
      return {
        name:sub.name, code:sub.code, max:sub.max, score:avgScore,
        grade:g?.grade||'—', points:g?.points||'—', label:g?.label||'—',
        sourceScores: scores  // one per source exam (null if missing)
      };
    }).filter(Boolean);
  } else {
    const examMarks = marks.filter(m=>m.examId===examId&&m.studentId===stuId);
    subjectRows = exam.subjectIds.map(sid=>{
      const sub = subjects.find(s=>s.id===sid); if(!sub) return null;
      const mk  = examMarks.find(m=>m.subjectId===sid);
      const score = mk ? mk.score : null;
      const g   = score !== null ? getGrade(score, sub.max) : null;
      return { name:sub.name, code:sub.code, max:sub.max, score, grade:g?.grade||'—', points:g?.points||'—', label:g?.label||'—' };
    }).filter(Boolean);
  }

  const examMarks = marks.filter(m=>m.examId===examId&&m.studentId===stuId);
  total  = subjectRows.reduce((a,r)=>a+(r.score!==null?r.score:0),0);
  mean   = exam.subjectIds.length ? total/exam.subjectIds.length : 0;
  mGrade = getMeanGrade(mean/(subjectRows.reduce((a,r)=>a+(r.max||100),0)/exam.subjectIds.length||100)*8);
  totalPoints = subjectRows.reduce((a,r)=>a+(typeof r.points==='number'?r.points:0),0);

  // Rank: overall
  const allStudentTotals = students.map(s=>{
    const tm=marks.filter(m=>m.examId===examId&&m.studentId===s.id).reduce((a,m)=>a+m.score,0);
    return {id:s.id,total:tm};
  }).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);
  const overallRank = allStudentTotals.findIndex(s=>s.id===stuId)+1;

  // Stream rank
  const streamStudents=students.filter(s=>s.streamId===stu.streamId).map(s=>{
    const tm=marks.filter(m=>m.examId===examId&&m.studentId===s.id).reduce((a,m)=>a+m.score,0);
    return {id:s.id,total:tm};
  }).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);
  const streamRank = streamStudents.findIndex(s=>s.id===stuId)+1;

  // Historical performance across all exams
  const history = exams.map(ex => {
    const exMarks = marks.filter(m=>m.examId===ex.id&&m.studentId===stuId);
    if (!exMarks.length) return null;
    const exTotal = exMarks.reduce((a,m)=>a+m.score,0);
    const exMean  = ex.subjectIds.length ? exTotal/ex.subjectIds.length : 0;
    const exG     = getMeanGrade(exMean/(subjects.filter(s=>ex.subjectIds.includes(s.id)).reduce((a,s)=>a+(s.max||100),0)/(ex.subjectIds.length||1)||100)*8);
    // Stream rank for this exam
    const strStudents = students.filter(s=>s.streamId===stu.streamId).map(s=>{
      const tm=marks.filter(m=>m.examId===ex.id&&m.studentId===s.id).reduce((a,m)=>a+m.score,0);
      return {id:s.id,total:tm};
    }).filter(s=>s.total>0).sort((a,b)=>b.total-a.total);
    const exStreamRank = strStudents.findIndex(s=>s.id===stuId)+1;
    return { examName:ex.name, term:ex.term, year:ex.year, mean:parseFloat(exMean.toFixed(2)), grade:exG.grade, total:exTotal, streamRank:exStreamRank };
  }).filter(Boolean);

  return { stu, exam, cls, stream, subjectRows, total, mean, mGrade, totalPoints, overallRank, streamRank, history, isConsolidated, sourceExamObjs };
}

function buildReportHTML(data, ctRemarks, principalRemarks, nextOpen, schoolClosed, feeBalance, feeNextTerm, feeStatus) {
  data.schoolClosed = schoolClosed;
  data.feeBalance = feeBalance;
  data.feeNextTerm = feeNextTerm;
  data.feeStatus = feeStatus;
  const s = settings;
  // Build table rows — for consolidated exams include one column per source exam + average
  const srcExams = data.sourceExamObjs || [];
  const rows = data.subjectRows.map((r,i)=>{
    if (data.isConsolidated && srcExams.length > 0) {
      const srcCols = (r.sourceScores||[]).map((sc,si)=>
        `<td style="text-align:center">${sc !== null ? sc : '—'}</td>`
      ).join('');
      return `<tr>
      <td>${i+1}</td>
      <td>${r.name}</td>
      <td style="text-align:center">${r.max}</td>
      ${srcCols}
      <td style="text-align:center;font-weight:700;background:#f0fdf4">${r.score !== null ? r.score : '—'}</td>
      <td style="text-align:center"><strong>${r.grade}</strong></td>
      <td style="text-align:center">${r.points}</td>
      <td>${r.label}</td>
    </tr>`;
    } else {
      return `<tr>
      <td>${i+1}</td>
      <td>${r.name}</td>
      <td style="text-align:center">${r.max}</td>
      <td style="text-align:center;font-weight:600">${r.score !== null ? r.score : '—'}</td>
      <td style="text-align:center"><strong>${r.grade}</strong></td>
      <td style="text-align:center">${r.points}</td>
      <td>${r.label}</td>
    </tr>`;
    }
  }).join('');

  return `
  <div class="report-form">
    <!-- HEADER -->
    <div class="rf-header">
      <div class="rf-logo">CA</div>
      <div class="rf-school-info">
        <h2>${s.schoolName||'School Name'}</h2>
        <p>${s.address||''} ${s.phone?'| Tel: '+s.phone:''} ${s.email?'| '+s.email:''}</p>
        <p style="font-weight:700;color:#16a34a">STUDENT PROGRESS REPORT — ${data.exam.term} ${data.exam.year}</p>
      </div>
    </div>

    <!-- STUDENT INFO -->
    <div class="rf-section">
      <div class="rf-section-title">Student Information</div>
      <div class="rf-section-body">
        <div class="rf-info-grid">
          <div class="rf-info-item"><span class="rf-info-label">Full Name</span><span class="rf-info-value">${data.stu.name}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Admission No</span><span class="rf-info-value">${data.stu.adm}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Gender</span><span class="rf-info-value">${data.stu.gender==='M'?'Male':'Female'}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Class</span><span class="rf-info-value">${data.cls?.name||'—'}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Stream</span><span class="rf-info-value">${data.stream?.name||'—'}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Exam</span><span class="rf-info-value">${data.exam.name}</span></div>
        </div>
      </div>
    </div>

    <!-- ACADEMIC PERFORMANCE -->
    <div class="rf-section">
      <div class="rf-section-title">Academic Performance</div>
      <div class="rf-section-body" style="padding:0">
        <table class="rf-marks-table">
          <thead>
            <tr>
              <th>#</th><th>Subject</th><th style="text-align:center">Out Of</th>
              ${data.isConsolidated && srcExams.length > 0
                ? srcExams.map(e=>`<th style="text-align:center;font-size:.72rem">${e.name}</th>`).join('')
                  + '<th style="text-align:center;background:#dcfce7">Average</th>'
                : '<th style="text-align:center">Score</th>'}
              <th style="text-align:center">Grade</th>
              <th style="text-align:center">Points</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="2" style="text-align:right">${data.isConsolidated ? 'AVERAGE TOTAL / MEAN' : 'TOTALS / MEAN'}</td>
              <td style="text-align:center">${data.subjectRows.reduce((a,r)=>a+r.max,0)}</td>
              ${data.isConsolidated && srcExams.length > 0
                ? srcExams.map((_,si)=>{
                    const colTotal = data.subjectRows.reduce((a,r)=>{
                      const sc=(r.sourceScores||[])[si]; return a+(sc!==null&&sc!==undefined?sc:0);
                    },0);
                    return `<td style="text-align:center">${parseFloat(colTotal.toFixed(1))}</td>`;
                  }).join('') + `<td style="text-align:center;font-weight:700;background:#f0fdf4">${parseFloat(data.total.toFixed(1))}</td>`
                : `<td style="text-align:center">${data.total}</td>`}
              <td style="text-align:center">${data.mGrade.grade}</td>
              <td style="text-align:center">${data.totalPoints}</td>
              <td>${data.mGrade.label}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PERFORMANCE SUMMARY -->
    <div class="rf-section">
      <div class="rf-section-title">Performance Summary</div>
      <div class="rf-section-body">
        <div class="rf-info-grid">
          <div class="rf-info-item"><span class="rf-info-label">Total Marks</span><span class="rf-info-value" style="color:#1a6fb5;font-size:11pt">${data.total}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Mean Score</span><span class="rf-info-value" style="color:#1a6fb5;font-size:11pt">${data.mean.toFixed(2)}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Grade</span><span class="rf-info-value" style="color:#16a34a;font-size:11pt">${data.mGrade.grade} — ${data.mGrade.label}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Stream Position</span><span class="rf-info-value">${data.streamRank > 0 ? data.streamRank + ' / ' + (students.filter(s=>s.streamId===data.stu.streamId).length) : '—'}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Overall Position</span><span class="rf-info-value">${data.overallRank > 0 ? data.overallRank + ' / ' + students.length : '—'}</span></div>
          <div class="rf-info-item"><span class="rf-info-label">Total Points</span><span class="rf-info-value">${data.totalPoints}</span></div>
        </div>
      </div>
    </div>

    <!-- PERFORMANCE TREND -->
    ${data.history && data.history.length > 1 ? `
    <div class="rf-section" style="margin-top:.5rem">
      <div class="rf-section-title" style="background:#7c3aed">📈 Performance Trend</div>
      <div class="rf-section-body">
        <canvas id="rfTrendChart_${data.stu.id}_${data.exam.id}" height="80" data-history="${encodeURIComponent(JSON.stringify(data.history))}"></canvas>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem">
          ${data.history.map(h=>`<div style="flex:1;min-width:80px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:.35rem .5rem;text-align:center;font-size:.72rem">
            <div style="font-weight:700;color:#1a6fb5">${h.mean}</div>
            <div style="color:#64748b">${h.grade}</div>
            <div style="color:#94a3b8;font-size:.65rem">${h.examName}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>` : ''}

    <!-- REMARKS -->
    <div class="rf-bottom">
      <div class="rf-remarks-box">
        <div class="rf-remarks-label">Class Teacher's Remarks</div>
        <div class="rf-remarks-text">${ctRemarks||'………………………………………………………………'}</div>
        <div class="rf-sig-line">Signature: ……………………………………  Date: ………………………</div>
      </div>
      <div class="rf-remarks-box">
        <div class="rf-remarks-label">Principal's Remarks</div>
        <div class="rf-remarks-text">${principalRemarks||'………………………………………………………………'}</div>
        <div class="rf-sig-line">Signature: ……………………………………  Date: ………………………</div>
      </div>
    </div>

    <!-- FEES SECTION -->
    ${(data.feeBalance !== undefined && data.feeBalance !== '') || data.feeStatus ? `
    <div class="rf-section" style="margin-top:.5rem;page-break-inside:avoid">
      <div class="rf-section-title" style="background:#1a6fb5">💰 Fee Statement</div>
      <div class="rf-section-body">
        <div class="rf-info-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="rf-info-item">
            <span class="rf-info-label">Fee Balance This Term</span>
            <span class="rf-info-value" style="color:${parseFloat(data.feeBalance||0)>0?'#dc2626':'#16a34a'};font-weight:700">KES ${parseFloat(data.feeBalance||0).toLocaleString()}</span>
          </div>
          <div class="rf-info-item">
            <span class="rf-info-label">Fees for Next Term</span>
            <span class="rf-info-value" style="font-weight:700">KES ${parseFloat(data.feeNextTerm||0).toLocaleString()}</span>
          </div>
          <div class="rf-info-item">
            <span class="rf-info-label">Payment Status</span>
            <span class="rf-info-value" style="color:${parseFloat(data.feeBalance||0)<=0?'#16a34a':'#dc2626'};font-weight:700;font-size:.82rem">
              ${parseFloat(data.feeBalance||0)<=0 ? '✅ FEES CLEARED' : '⚠️ BALANCE OUTSTANDING'}
            </span>
          </div>
        </div>
        ${parseFloat(data.feeBalance||0) > 0 ? `
        <div style="margin-top:.5rem;padding:.5rem .75rem;background:#fff1f2;border-left:3px solid #dc2626;border-radius:0 4px 4px 0;font-size:.77rem;color:#dc2626">
          ⚠️ Outstanding balance of KES ${parseFloat(data.feeBalance||0).toLocaleString()} must be cleared. Please contact the school bursar for payment arrangements.
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- FOOTER -->
    <div class="rf-footer">
      <span>School Closed: <strong>${data.schoolClosed||'…………………'}</strong></span>
      <span>Next Term Opens: <strong>${nextOpen||'…………………………'}</strong></span>
    </div>
    <div class="rf-footer" style="border-top:none;padding-top:0">
      <span style="color:#1a6fb5;font-weight:700">${s.schoolName||''}</span>
      <span>Printed: ${new Date().toLocaleDateString()}</span>
    </div>
  </div>`;
}

function generateReport() {
  const examId      = document.getElementById('rpExam').value;
  const stuId       = document.getElementById('rpStudent').value;
  const streamId    = document.getElementById('rpStream').value;
  let ctR           = document.getElementById('rpCTRemarks').value;
  let prR           = document.getElementById('rpPrincipalRemarks').value;
  const nextOpen    = document.getElementById('rpNextOpen').value;
  const schoolClosed= document.getElementById('rpSchoolClosed')?.value || '';
  const feeBalance  = document.getElementById('rpFeeBalance')?.value || '';
  const feeNextTerm = document.getElementById('rpFeeNextTerm')?.value || '';
  const autoComments = document.getElementById('rpAutoComments')?.checked !== false;
  // Resolve effective term/year for fee auto-link (manual override > exam derived)
  const rpTermOverride = document.getElementById('rpTerm')?.value || '';
  const rpYearOverride = document.getElementById('rpYear')?.value || '';
  if (!examId) { showToast('Select an exam','error'); return; }

  let stuList = stuId ? [students.find(s=>s.id===stuId)].filter(Boolean)
    : streamId ? students.filter(s=>s.streamId===streamId) : [...students];
  stuList = stuList.sort((a,b)=>a.name.localeCompare(b.name));

  const area = document.getElementById('reportPreviewArea');
  area.innerHTML = stuList.map(stu => {
    const d = getStudentReport(stu.id, examId);
    if (!d) return '';
    let finalCT = ctR;
    let finalPR = prR;
    if (autoComments) {
      finalCT = generateCTComment(d.mean, d.mGrade.grade, stu.gender, stu.name, d.streamRank, stuList.length);
      finalPR = generatePrincipalComment(d.mean, d.mGrade.grade, d.overallRank, students.length);
    }
    // Auto-lookup fee balance per student — use manual term/year override if set
    let autoFeeBalance = '';
    let autoFeeStatus  = '';
    let autoFeeNextTerm = feeNextTerm; // start with manual override
    const feeLookupTerm = rpTermOverride || (d.exam?.term) || '';
    const feeLookupYear = rpYearOverride || (d.exam?.year ? String(d.exam.year) : '');
    if (feeLookupTerm && feeLookupYear) {
      const feeData = getStudentFeeStatus(stu.id, feeLookupTerm, feeLookupYear);
      if (feeData.balance !== null) {
        autoFeeBalance = feeData.balance;
        autoFeeStatus  = feeData.status;
      }
      // Auto-lookup next-term fee from structures if not manually overridden
      if (feeNextTerm === '') {
        loadFees();
        const termMap = {'Term 1':'Term 2','Term 2':'Term 3','Term 3':'Term 1'};
        const nxtTerm = termMap[feeLookupTerm] || feeLookupTerm;
        const nxtYear = feeLookupTerm==='Term 3' ? String(parseInt(feeLookupYear)+1) : feeLookupYear;
        const struct  = feeStructures.find(f => f.classId===stu.classId && f.term===nxtTerm && String(f.year)===nxtYear);
        if (struct) autoFeeNextTerm = struct.totalFee;
      }
    }
    // feeBalance input is a fallback only — if auto-lookup found nothing, use manual default
    if (autoFeeBalance === '' && feeBalance !== '') autoFeeBalance = feeBalance;
    return buildReportHTML(d, finalCT, finalPR, nextOpen, schoolClosed, autoFeeBalance, autoFeeNextTerm, autoFeeStatus);
  }).join('');

  showToast(`${stuList.length} report(s) generated ✓`,'success');
  area.scrollIntoView({behavior:'smooth'});
  // Draw trend charts after DOM settles
  setTimeout(() => {
    area.querySelectorAll('canvas[id^="rfTrendChart_"]').forEach(canvas => {
      if (canvas.dataset.drawn) return;
      canvas.dataset.drawn = '1';
      try {
        const hist = JSON.parse(decodeURIComponent(canvas.dataset.history||'[]'));
        if (hist.length < 2) return;
        new Chart(canvas, {
          type:'line',
          data:{
            labels: hist.map(h=>h.examName),
            datasets:[
              {label:'Mean Score',data:hist.map(h=>h.mean),borderColor:'#1a6fb5',backgroundColor:'rgba(26,111,181,0.08)',tension:0.4,fill:true,pointRadius:5,pointBackgroundColor:'#1a6fb5'},
              {label:'Stream Rank',data:hist.map(h=>h.streamRank),borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,0.05)',tension:0.4,fill:false,pointRadius:4,pointBackgroundColor:'#16a34a',yAxisID:'y2'}
            ]
          },
          options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',labels:{font:{size:10}}}},scales:{y:{beginAtZero:false,title:{display:true,text:'Mean Score',font:{size:9}}},y2:{type:'linear',display:true,position:'right',reverse:true,title:{display:true,text:'Stream Rank',font:{size:9}},grid:{drawOnChartArea:false}}}}
        });
      } catch(e) { console.warn('Trend chart error', e); }
    });
  }, 200);
}

function previewReport() { generateReport(); }

// ═══════════════ MESSAGING ═══════════════
function loadMsgRecipients() {
  const type    = document.getElementById('msgType').value;
  const filter  = document.getElementById('msgFilter').value;
  const list    = document.getElementById('msgRecipientsList');
  let recipients = [];
  if (type==='parent'||type==='all') {
    let stuList = filter ? students.filter(s=>s.streamId===filter||s.classId===filter) : students;
    recipients = stuList.filter(s=>s.contact).map(s=>({name:s.parent||s.name, phone:s.contact, student:s.name}));
  } else if (type==='teacher') {
    recipients = teachers.filter(t=>t.phone).map(t=>({name:t.name,phone:t.phone,student:''}));
  } else if (type==='individual') {
    const filterStu = filter ? students.filter(s=>s.streamId===filter||s.classId===filter) : students;
    recipients = filterStu.filter(s=>s.contact).map(s=>({name:s.parent||s.name,phone:s.contact,student:s.name}));
  }
  list.innerHTML = recipients.length ? recipients.map(r=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border-lt);font-size:.85rem">
      <div><strong>${r.name}</strong>${r.student?' — '+r.student:''}</div>
      <span style="font-family:var(--mono);color:var(--muted);font-size:.78rem">${r.phone}</span>
    </div>`).join('')
  : '<p style="color:var(--muted);text-align:center;padding:1rem">No recipients found.</p>';

  // update filter dropdown
  const mf=document.getElementById('msgFilter');
  mf.innerHTML='<option value="">All</option>'+
    streams.map(s=>`<option value="${s.id}">Stream: ${s.name}</option>`).join('')+
    classes.map(c=>`<option value="${c.id}">Class: ${c.name}</option>`).join('');
}

function sendBulkSMS() {
  const msg=document.getElementById('msgText').value.trim();
  if(!msg){showToast('Enter a message first','error');return;}
  const count=document.querySelectorAll('#msgRecipientsList > div').length;
  if(!count){showToast('No recipients selected','error');return;}
  if(smsCredits<count){showToast(`Insufficient credits. Need ${count}, have ${smsCredits}`,'warning');return;}
  smsCredits-=count;
  localStorage.setItem(K.smsCredits,smsCredits);
  document.getElementById('smsCredits').textContent=smsCredits;
  const log={id:uid(),date:new Date().toLocaleString(),to:`${count} recipients`,preview:msg.slice(0,60)+'...',status:'Sent',credits:count};
  msgLog.unshift(log); save(K.msgLog,msgLog);
  renderMsgLog(); showToast(`SMS sent to ${count} recipients ✓`,'success');
}

function sendResultsSMS() {
  showToast('Connect to an SMS gateway (e.g. Africa\'s Talking) to enable this feature','info');
}

function renderMsgLog() {
  document.getElementById('msgLogBody').innerHTML=msgLog.map((m,i)=>`
    <tr>
      <td>${i+1}</td><td>${m.date}</td><td>${m.to}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${m.preview}</td>
      <td><span class="badge b-green">${m.status}</span></td>
      <td>${m.credits}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1.5rem">No messages sent yet.</td></tr>';
}

function openMpesaModal() {
  showModal('💳 Buy SMS Credits (M-Pesa)',`
    <p style="margin-bottom:1rem;font-size:.875rem;color:var(--muted)">Enter amount to purchase SMS credits. 1 credit = 1 SMS.</p>
    <div class="fg" style="margin-bottom:1rem"><label>Amount (KES)</label><input type="number" id="mpesaAmount" placeholder="e.g. 500" min="100"/></div>
    <div class="fg"><label>M-Pesa Phone</label><input type="tel" id="mpesaPhone" placeholder="07XX XXX XXX"/></div>
    <p style="margin-top:1rem;font-size:.78rem;color:var(--muted)">KES 100 = 100 SMS credits. A payment prompt will be sent to your phone.</p>
  `,[
    {label:'💳 Pay Now', cls:'btn-primary', action:'processMpesa()'},
    {label:'Cancel', cls:'btn-outline', action:'closeModal()'}
  ]);
}

function processMpesa() {
  const amt=parseInt(document.getElementById('mpesaAmount')?.value||0);
  if(!amt||amt<100){showToast('Minimum KES 100','error');return;}
  smsCredits+=amt; localStorage.setItem(K.smsCredits,smsCredits);
  document.getElementById('smsCredits').textContent=smsCredits;
  closeModal(); showToast(`${amt} SMS credits added ✓`,'success');
}

// ═══════════════ SETTINGS ═══════════════
function loadSettings() {
  const s=settings;
  document.getElementById('setSchoolName').value=s.schoolName||'';
  document.getElementById('setSchoolAddr').value=s.address||'';
  document.getElementById('setSchoolPhone').value=s.phone||'';
  document.getElementById('setSchoolEmail').value=s.email||'';
  document.getElementById('setTerm').value=s.term||'Term 1';
  document.getElementById('setYear').value=s.year||'2025';
  document.getElementById('sbSchoolName').textContent=s.schoolName||'School';
  // Global teacher restrictions (super admin only)
  const rta = document.getElementById('restrictTeacherAnalytics');
  const rtf = document.getElementById('restrictTeacherFees');
  const rtl = document.getElementById('restrictTeacherList');
  if (rta) rta.checked = !!s.restrictTeacherAnalytics;
  if (rtf) rtf.checked = !!s.restrictTeacherFees;
  if (rtl) rtl.checked = !!s.restrictTeacherList;
  renderAdminList();
}

function saveSettings() {
  settings={
    schoolName:document.getElementById('setSchoolName').value.trim(),
    address:document.getElementById('setSchoolAddr').value.trim(),
    phone:document.getElementById('setSchoolPhone').value.trim(),
    email:document.getElementById('setSchoolEmail').value.trim(),
    term:document.getElementById('setTerm').value,
    year:document.getElementById('setYear').value,
    restrictTeacherAnalytics: settings.restrictTeacherAnalytics || false,
    restrictTeacherFees:      settings.restrictTeacherFees      || false,
    restrictTeacherList:      settings.restrictTeacherList      || false,
  };
  save(K.settings,[settings]);
  document.getElementById('sbSchoolName').textContent=settings.schoolName||'School';
  showToast('Settings saved ✓','success');
}

function saveGlobalTeacherRestrictions() {
  settings.restrictTeacherAnalytics = !!document.getElementById('restrictTeacherAnalytics')?.checked;
  settings.restrictTeacherFees      = !!document.getElementById('restrictTeacherFees')?.checked;
  settings.restrictTeacherList      = !!document.getElementById('restrictTeacherList')?.checked;
  save(K.settings, [settings]);
  // Re-apply UI if a teacher is currently logged in
  if (currentUser && currentUser.role === 'teacher') applyRoleBasedUI();
  showToast('Teacher restrictions saved ✓', 'success');
}

function renderAdminList() {
  const list=[
    {name:'Super Admin',username:'superadmin',role:'superadmin',builtin:true},
    ...admins
  ];
  document.getElementById('adminList').innerHTML=list.map(a=>`
    <div class="admin-item">
      <div><div class="ai-name">${a.name}</div><div class="ai-role">${a.username} · <span class="badge ${a.role==='superadmin'?'b-amber':a.role==='principal'?'b-teal':a.role==='bursar'?'b-green':'b-blue'}">${a.role}</span></div></div>
      ${!a.builtin?`<button class="icb dl" onclick="deleteAdmin('${a.id||''}')">🗑️</button>`:'<span style="font-size:.75rem;color:var(--muted)">Built-in</span>'}
    </div>`).join('') || '<p style="color:var(--muted);font-size:.85rem">No admin accounts.</p>';
}

function addAdminAccount() {
  const name=document.getElementById('newAdminName').value.trim();
  const user=document.getElementById('newAdminUser').value.trim();
  const pass=document.getElementById('newAdminPass').value;
  const role=document.getElementById('newAdminRole').value;
  if(!name||!user||!pass){showToast('All fields required','error');return;}
  if(admins.find(a=>a.username===user)){showToast('Username already exists','error');return;}
  admins.push({id:uid(),name,username:user,password:pass,role});
  save(K.admins,admins);
  ['newAdminName','newAdminUser','newAdminPass'].forEach(id=>document.getElementById(id).value='');
  renderAdminList(); showToast('Admin account created ✓','success');
}

function deleteAdmin(id) {
  if(!id||!confirm('Delete this admin account?'))return;
  admins=admins.filter(a=>a.id!==id);
  save(K.admins,admins); renderAdminList(); showToast('Account deleted','info');
}

// ═══════════════ DATA EXPORT/IMPORT ═══════════════
function exportAllData() {
  const data={students,subjects,teachers,classes,streams,exams,marks,settings,admins};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`examinsight_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
  showToast('Data exported ✓','success');
}

function importData(input) {
  const file=input.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const data=JSON.parse(e.target.result);
      if(data.students){students=data.students;save(K.students,students);}
      if(data.subjects){subjects=data.subjects;save(K.subjects,subjects);}
      if(data.teachers){teachers=data.teachers;save(K.teachers,teachers);}
      if(data.classes){classes=data.classes;save(K.classes,classes);}
      if(data.streams){streams=data.streams;save(K.streams,streams);}
      if(data.exams){exams=data.exams;save(K.exams,exams);}
      if(data.marks){marks=data.marks;save(K.marks,marks);}
      if(data.settings){settings=data.settings;save(K.settings,[settings]);}
      if(data.admins){admins=data.admins;save(K.admins,admins);}
      renderStudents();renderTeachers();renderSubjects();renderClasses();renderStreams();renderExamList();
      populateAllDropdowns();populateExamDropdowns();renderDashboard();loadSettings();
      showToast('Data imported successfully ✓','success');
    } catch(err){showToast('Invalid JSON file','error');console.error(err);}
  };
  reader.readAsText(file); input.value='';
}

function clearAllData() {
  if(!confirm('DELETE ALL DATA? This cannot be undone!'))return;
  if(!confirm('Are you absolutely sure? All students, marks, and exams will be lost.'))return;
  Object.values(K).forEach(k=>localStorage.removeItem(k));
  location.reload();
}

// ═══════════════ ANALYSIS EXPORT ═══════════════
function exportAnalysisPDF() {
  try {
    const {jsPDF}=window.jspdf; const doc=new jsPDF();
    doc.setFontSize(16);doc.setFont(undefined,'bold');
    doc.text(`Charanas Analyzer — Analysis Report`,14,18);
    doc.setFontSize(10);doc.setFont(undefined,'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()} | School: ${settings.schoolName||''}`,14,26);

    const examId=document.getElementById('anExam')?.value;
    const exam=exams.find(e=>e.id===examId);
    if(exam){
      doc.setFontSize(12);doc.setFont(undefined,'bold');
      doc.text(`Exam: ${exam.name} — ${exam.term} ${exam.year}`,14,36);
      const subjectData=exam.subjectIds.map(sid=>{
        const sub=subjects.find(s=>s.id===sid);
        const vals=marks.filter(m=>m.examId===examId&&m.subjectId===sid).map(m=>m.score);
        const mn=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
        return [sub?.name||'?',vals.length,mn.toFixed(1),vals.length?Math.max(...vals):'—',vals.length?Math.min(...vals):'—'];
      });
      doc.autoTable({startY:44,head:[['Subject','Count','Mean','Max','Min']],body:subjectData,theme:'striped',headStyles:{fillColor:[26,111,181]}});
    }
    doc.save('analysis_report.pdf');
    showToast('PDF exported ✓','success');
  } catch(e){showToast('PDF export error','error');console.error(e);}
}

function exportAnalysisExcel() {
  const examId=document.getElementById('anExam')?.value; if(!examId) return;
  const exam=exams.find(e=>e.id===examId);
  const rows=exam?.subjectIds.map(sid=>{
    const sub=subjects.find(s=>s.id===sid);
    const vals=marks.filter(m=>m.examId===examId&&m.subjectId===sid).map(m=>m.score);
    const mn=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
    return {Subject:sub?.name,Count:vals.length,Mean:mn.toFixed(1),Highest:vals.length?Math.max(...vals):'',Lowest:vals.length?Math.min(...vals):''};
  })||[];
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Analysis');
  XLSX.writeFile(wb,`analysis_${exam?.name||'exam'}.xlsx`);
}

// ─── SUBJECT ANALYSIS EXPORTS ────────────────────────────────
function exportSubjectAnalysisPDF() {
  const examId = document.getElementById('saExam').value;
  if (!examId) { showToast('Select an exam first','error'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const exam   = exams.find(e=>e.id===examId);
    const examMarks = marks.filter(m=>m.examId===examId);
    const gs     = getActiveGradingSystem();
    const gradeKeys = gs.bands.map(b=>b.grade);
    const doc    = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const PW     = doc.internal.pageSize.getWidth();
    doc.setFillColor(26,111,181); doc.rect(0,0,PW,14,'F');
    doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
    doc.text(settings.schoolName||'School', 14, 9);
    doc.setFontSize(9); doc.setFont(undefined,'normal');
    doc.text(`Subject Analysis — ${exam?.name||''} | ${exam?.term||''} ${exam?.year||''}`, PW-14, 9, {align:'right'});
    doc.setTextColor(0,0,0);
    doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text('Subject Grade Distribution & Gender Performance', 14, 22);
    const head = [['Subject','N','Mean','High','Low', ...gradeKeys, 'Grade','♂ Mean','♀ Mean']];
    const body = (exam?.subjectIds||[]).map(sid=>{
      const sub=subjects.find(s=>s.id===sid); if(!sub) return null;
      const sm=examMarks.filter(m=>m.subjectId===sid); if(!sm.length) return null;
      const vals=sm.map(m=>m.score);
      const mn=vals.reduce((a,b)=>a+b,0)/vals.length;
      const dist={}; gradeKeys.forEach(g=>dist[g]=0);
      sm.forEach(m=>{const g=getGrade(m.score,sub.max);if(dist[g.grade]!==undefined)dist[g.grade]++;});
      const mV=sm.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='M';}).map(m=>m.score);
      const fV=sm.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='F';}).map(m=>m.score);
      return [sub.name,vals.length,mn.toFixed(1),Math.max(...vals),Math.min(...vals),
              ...gradeKeys.map(g=>dist[g]||''), getGrade(mn,sub.max).grade,
              mV.length?(mV.reduce((a,b)=>a+b,0)/mV.length).toFixed(1):'—',
              fV.length?(fV.reduce((a,b)=>a+b,0)/fV.length).toFixed(1):'—'];
    }).filter(Boolean);
    doc.autoTable({startY:26,head,body,theme:'striped',styles:{fontSize:8,cellPadding:2},headStyles:{fillColor:[26,111,181],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[240,247,255]}});
    doc.save(`subject_analysis_${exam?.name||'exam'}.pdf`);
    showToast('Subject analysis PDF exported ✓','success');
  } catch(err){showToast('PDF error: '+err.message,'error');console.error(err);}
}

function exportSubjectAnalysisExcel() {
  const examId = document.getElementById('saExam').value;
  if (!examId) { showToast('Select an exam first','error'); return; }
  const exam   = exams.find(e=>e.id===examId);
  const examMarks = marks.filter(m=>m.examId===examId);
  const gs     = getActiveGradingSystem();
  const gradeKeys = gs.bands.map(b=>b.grade);
  const rows   = (exam?.subjectIds||[]).map(sid=>{
    const sub=subjects.find(s=>s.id===sid); if(!sub) return null;
    const sm=examMarks.filter(m=>m.subjectId===sid); if(!sm.length) return null;
    const vals=sm.map(m=>m.score); const mn=vals.reduce((a,b)=>a+b,0)/vals.length;
    const dist={}; gradeKeys.forEach(g=>dist[g]=0);
    sm.forEach(m=>{const g=getGrade(m.score,sub.max);if(dist[g.grade]!==undefined)dist[g.grade]++;});
    const mV=sm.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='M';}).map(m=>m.score);
    const fV=sm.filter(m=>{const s=students.find(x=>x.id===m.studentId);return s&&s.gender==='F';}).map(m=>m.score);
    const row={Subject:sub.name,Entries:vals.length,Mean:mn.toFixed(1),Highest:Math.max(...vals),Lowest:Math.min(...vals)};
    gradeKeys.forEach(g=>row[g]=dist[g]||0);
    row['Grade']=getGrade(mn,sub.max).grade;
    row['Male Mean']=mV.length?(mV.reduce((a,b)=>a+b,0)/mV.length).toFixed(1):'';
    row['Female Mean']=fV.length?(fV.reduce((a,b)=>a+b,0)/fV.length).toFixed(1):'';
    return row;
  }).filter(Boolean);
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Subject Analysis');
  XLSX.writeFile(wb,`subject_analysis_${exam?.name||'exam'}.xlsx`);
  showToast('Exported to Excel ✓','success');
}

// ═══════════════ UTILITIES ═══════════════
function filterTbl(id, q) {
  const lq=q.toLowerCase();
  document.querySelectorAll(`#${id} tbody tr`).forEach(r=>{
    r.style.display=r.textContent.toLowerCase().includes(lq)?'':'none';
  });
}

function showModal(title, bodyHTML, buttons=[]) {
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=bodyHTML;
  document.getElementById('modalFt').innerHTML=buttons.map(b=>`<button class="btn ${b.cls}" onclick="${b.action}">${b.label}</button>`).join('');
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
document.getElementById('modalOverlay')?.addEventListener('click',e=>{ if(e.target===document.getElementById('modalOverlay'))closeModal(); });

let toastT;
function showToast(msg, type='success') {
  const t=document.getElementById('toast');
  const icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  t.innerHTML=`${icons[type]||''} ${msg}`;
  t.className=`toast ${type} show`;
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),3500);
}

// Drag-drop upload zones
document.addEventListener('DOMContentLoaded',()=>{
  ['marksUploadZone'].forEach(zoneId=>{
    const zone=document.getElementById(zoneId); if(!zone) return;
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.style.borderColor='var(--primary)';});
    zone.addEventListener('dragleave',()=>zone.style.borderColor='');
    zone.addEventListener('drop',e=>{
      e.preventDefault();zone.style.borderColor='';
      const f=e.dataTransfer.files[0]; if(!f) return;
      const inp=document.getElementById('marksFile');
      const dt=new DataTransfer(); dt.items.add(f); inp.files=dt.files;
      handleMarksUpload(inp);
    });
  });
});

// ═══════════════ CLASS & STREAM LIST DOWNLOADS ═══════════════
function downloadClassList(classId) {
  const cls = classes.find(c=>c.id===classId); if(!cls) return;
  const stuList = students.filter(s=>s.classId===classId).sort((a,b)=>a.name.localeCompare(b.name));
  const rows = stuList.map((s,i)=>{
    const str = streams.find(x=>x.id===s.streamId);
    return { '#':i+1, AdmNo:s.adm, Name:s.name, Gender:s.gender, Class:cls.name, Stream:str?.name||'—', ParentName:s.parent||'', Contact:s.contact||'' };
  });
  if (!rows.length) { showToast('No students in this class','warning'); return; }
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,cls.name);
  XLSX.writeFile(wb,`students_${cls.name.replace(/\s+/g,'_')}.xlsx`);
  showToast(`${cls.name} student list downloaded ✓`,'success');
}

function downloadStreamList(streamId) {
  const str = streams.find(s=>s.id===streamId); if(!str) return;
  const cls = classes.find(c=>c.id===str.classId);
  const stuList = students.filter(s=>s.streamId===streamId).sort((a,b)=>a.name.localeCompare(b.name));
  const rows = stuList.map((s,i)=>({
    '#':i+1, AdmNo:s.adm, Name:s.name, Gender:s.gender,
    Class:cls?.name||'—', Stream:str.name, ParentName:s.parent||'', Contact:s.contact||''
  }));
  if (!rows.length) { showToast('No students in this stream','warning'); return; }
  const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,str.name);
  XLSX.writeFile(wb,`students_${str.name.replace(/\s+/g,'_')}_stream.xlsx`);
  showToast(`${str.name} stream list downloaded ✓`,'success');
}

// ═══════════════ MERIT LIST TYPE SWITCHER ═══════════════
function onMlTypeChange() {
  const type = document.getElementById('mlType').value;
  const streamRow = document.getElementById('mlStreamRow');
  if (type === 'class_stream') {
    streamRow.style.display = '';
    populateMeritStreamDropdown();
  } else {
    streamRow.style.display = 'none';
  }
  renderMeritList();
}

function populateMeritStreamDropdown() {
  const el = document.getElementById('mlStream'); if (!el) return;
  el.innerHTML = '<option value="">— Select Stream —</option>' +
    streams.map(s=>`<option value="${s.id}">${s.name} (${classes.find(c=>c.id===s.classId)?.name||''})</option>`).join('');
}

// ═══════════════ EDIT GRADING SYSTEM ═══════════════
function editGS(id) {
  const gs = gradingSystems.find(g=>g.id===id); if (!gs) return;
  const bandsHTML = gs.bands.map(b=>`
    <tr class="gs-band-row" data-orig-grade="${b.grade}">
      <td><input type="number" class="gs-min" value="${b.min}" min="0" max="100" style="width:60px"/></td>
      <td><input type="number" class="gs-max" value="${b.max}" min="0" max="100" style="width:60px"/></td>
      <td><input type="text" class="gs-grade" value="${b.grade}" maxlength="4" style="width:60px"/></td>
      <td><input type="number" class="gs-pts" value="${b.points}" min="0" max="10" step="0.5" style="width:60px"/></td>
      <td><input type="text" class="gs-lbl" value="${b.label||''}" style="width:120px"/></td>
      <td><button type="button" class="icb dl" onclick="this.closest('tr').remove()">🗑</button></td>
    </tr>`).join('');

  showModal(`✏️ Edit Grading System — ${gs.name}`, `
    <div style="margin-bottom:.75rem">
      <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.4rem">System Name</label>
      <input type="text" id="editGsName" value="${gs.name}" style="width:100%;padding:.5rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-family:inherit"/>
    </div>
    <div class="tbl-wrap">
      <table style="font-size:.82rem">
        <thead><tr><th>Min%</th><th>Max%</th><th>Grade</th><th>Points</th><th>Label</th><th></th></tr></thead>
        <tbody id="editGsBandsBody">${bandsHTML}</tbody>
      </table>
    </div>
    <button type="button" class="btn btn-outline btn-sm" style="margin-top:.5rem" onclick="addEditGSBandRow()">➕ Add Band</button>
  `, [
    { label:'💾 Save Changes', cls:'btn-primary', action:`saveEditedGS('${id}')` },
    { label:'Cancel', cls:'btn-outline', action:'closeModal()' }
  ]);
}

function addEditGSBandRow() {
  const tbody = document.getElementById('editGsBandsBody'); if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'gs-band-row';
  tr.innerHTML = `
    <td><input type="number" class="gs-min" placeholder="0" min="0" max="100" style="width:60px"/></td>
    <td><input type="number" class="gs-max" placeholder="100" min="0" max="100" style="width:60px"/></td>
    <td><input type="text" class="gs-grade" placeholder="EE1" maxlength="4" style="width:60px"/></td>
    <td><input type="number" class="gs-pts" placeholder="8" min="0" max="10" step="0.5" style="width:60px"/></td>
    <td><input type="text" class="gs-lbl" placeholder="Outstanding" style="width:120px"/></td>
    <td><button type="button" class="icb dl" onclick="this.closest('tr').remove()">🗑</button></td>`;
  tbody.appendChild(tr);
}

function saveEditedGS(id) {
  const nameEl = document.getElementById('editGsName');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { showToast('System name required','error'); return; }
  const rows = document.querySelectorAll('#editGsBandsBody .gs-band-row');
  const bands = [];
  let valid = true;
  rows.forEach(row => {
    const min = parseInt(row.querySelector('.gs-min').value);
    const max = parseInt(row.querySelector('.gs-max').value);
    const grade = row.querySelector('.gs-grade').value.trim();
    const points = parseFloat(row.querySelector('.gs-pts').value);
    const label = row.querySelector('.gs-lbl').value.trim();
    if (!grade || isNaN(min) || isNaN(max) || isNaN(points)) { valid=false; return; }
    const clsMap = { EE1:'b-green',EE2:'b-teal',ME1:'b-blue',ME2:'b-lblue',AE1:'b-amber',AE2:'b-orange',BE1:'b-red',BE2:'b-dkred' };
    bands.push({ min, max, grade, points, label, cls: clsMap[grade]||'b-blue' });
  });
  if (!valid || !bands.length) { showToast('Fill all band rows correctly','error'); return; }
  bands.sort((a,b)=>b.min-a.min);
  const idx = gradingSystems.findIndex(g=>g.id===id);
  if (idx > -1) { gradingSystems[idx] = { ...gradingSystems[idx], name, bands }; }
  localStorage.setItem(K_GS, JSON.stringify(gradingSystems));
  closeModal();
  renderGradingSystemsTab();
  showToast('Grading system updated ✓','success');
}

// ═══════════════ MERIT LIST – UPDATED RENDER ═══════════════
function renderMeritList() {
  const examId   = document.getElementById('mlExam').value;
  const type     = document.getElementById('mlType')?.value || 'class_overall_and_stream';
  const container= document.getElementById('meritListWrap');
  if (!examId) { container.innerHTML='<p style="color:var(--muted);padding:1rem">Select an exam to generate the merit list.</p>'; return; }

  const exam = exams.find(e=>e.id===examId);

  if (type === 'class_overall') {
    // Overall class list — all streams combined, ranked together
    const allScored = buildMeritData(examId, null);
    const subAnalysis = buildSubjectAnalysisHTML(examId, allScored.map(s=>s.id));
    const { headerRow, bodyRows } = buildMeritTableHTML(allScored, examId, true);
    container.innerHTML = `
      <h3 style="margin-bottom:.75rem;font-family:var(--font);font-weight:700">🏆 Overall Class Merit List — ${exam?.name||''}</h3>
      <div class="tbl-wrap">
        <table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>
      </div>
      ${subAnalysis}`;

  } else if (type === 'class_stream') {
    // Single stream selected
    const streamId = document.getElementById('mlStream')?.value;
    if (!streamId) { container.innerHTML='<p style="color:var(--muted);padding:1rem">Select a stream from the dropdown above.</p>'; return; }
    const streamScored = buildMeritData(examId, streamId);
    const str = streams.find(s=>s.id===streamId);
    const { headerRow, bodyRows } = buildMeritTableHTML(streamScored, examId, false);
    const streamSubAnalysis = buildSubjectAnalysisHTML(examId, streamScored.map(s=>s.id));
    container.innerHTML = `
      <h3 style="margin-bottom:.75rem;font-family:var(--font);font-weight:700">🌊 Stream Merit List — ${str?.name||streamId}</h3>
      <div class="tbl-wrap">
        <table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>
      </div>
      ${streamSubAnalysis}`;

  } else {
    // class_overall_and_stream — overall + per-stream sections
    const allScored = buildMeritData(examId, null);
    const subAnalysis = buildSubjectAnalysisHTML(examId, allScored.map(s=>s.id));
    const { headerRow:allHdr, bodyRows:allRows } = buildMeritTableHTML(allScored, examId, true);
    const examStreams = [...new Set(allScored.map(s=>s.streamId))].map(sid=>streams.find(x=>x.id===sid)).filter(Boolean);
    const streamSections = examStreams.map(str => {
      const strScored = buildMeritData(examId, str.id);
      const { headerRow, bodyRows } = buildMeritTableHTML(strScored, examId, false);
      const strSubAnalysis = buildSubjectAnalysisHTML(examId, strScored.map(s=>s.id));
      return `
        <div style="margin-top:2rem;page-break-before:always">
          <h3 style="margin-bottom:.75rem;font-family:var(--font);font-weight:700;color:var(--secondary)">🌊 ${str.name} Stream — Merit List</h3>
          <div class="tbl-wrap">
            <table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>
          </div>
          ${strSubAnalysis}
        </div>`;
    }).join('');
    container.innerHTML = `
      <h3 style="margin-bottom:.75rem;font-family:var(--font);font-weight:700">🏆 Overall Grade Merit List — ${exam?.name||''}</h3>
      <div class="tbl-wrap">
        <table><thead>${allHdr}</thead><tbody>${allRows}</tbody></table>
      </div>
      ${subAnalysis}
      ${streamSections}`;
  }
}

// ═══════════════ DOWNLOAD ALL REPORT FORMS AS PDF ═══════════════
function downloadAllReportsPDF() {
  const examId   = document.getElementById('rpExam').value;
  const streamId = document.getElementById('rpStream')?.value || '';
  const stuId    = document.getElementById('rpStudent')?.value || '';
  const nextOpen = document.getElementById('rpNextOpen').value;
  const schoolClosed = document.getElementById('rpSchoolClosed')?.value||'';
  const feeBalance   = document.getElementById('rpFeeBalance')?.value||'';
  const feeNextTerm  = document.getElementById('rpFeeNextTerm')?.value||'';
  const autoComments = document.getElementById('rpAutoComments')?.checked !== false;
  const ctR  = document.getElementById('rpCTRemarks').value;
  const prR  = document.getElementById('rpPrincipalRemarks').value;

  if (!examId) { showToast('Select an exam first','error'); return; }

  let stuList = stuId ? [students.find(s=>s.id===stuId)].filter(Boolean)
    : streamId ? students.filter(s=>s.streamId===streamId) : [...students];
  stuList = stuList.sort((a,b)=>a.name.localeCompare(b.name));

  if (!stuList.length) { showToast('No students to generate reports for','warning'); return; }

  showToast(`Generating PDF for ${stuList.length} student(s)…`,'info');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();

    stuList.forEach((stu, idx) => {
      if (idx > 0) doc.addPage();
      const d = getStudentReport(stu.id, examId); if (!d) return;

      let ctRemark = ctR;
      let prRemark = prR;
      if (autoComments) {
        ctRemark = generateCTComment(d.mean, d.mGrade.grade, stu.gender, stu.name, d.streamRank, stuList.length);
        prRemark = generatePrincipalComment(d.mean, d.mGrade.grade, d.overallRank, students.length);
      }

      const s = settings;
      // Header bar
      doc.setFillColor(26,111,181); doc.rect(0,0,PW,14,'F');
      doc.setFontSize(12); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
      doc.text(s.schoolName||'School Name', 14, 9);
      doc.setFontSize(8); doc.setFont(undefined,'normal');
      doc.text(`STUDENT PROGRESS REPORT — ${d.exam.term} ${d.exam.year}`, PW-14, 9, {align:'right'});
      doc.setTextColor(0,0,0);

      // Student info block
      doc.setFontSize(9); doc.setFont(undefined,'bold');
      doc.text('STUDENT INFORMATION', 14, 20);
      doc.setFont(undefined,'normal'); doc.setFontSize(8.5);
      const info = [
        [`Name: ${stu.name}`, `Adm No: ${stu.adm}`],
        [`Class: ${d.cls?.name||'—'}`, `Stream: ${d.stream?.name||'—'}`],
        [`Gender: ${stu.gender==='M'?'Male':'Female'}`, `Exam: ${d.exam.name}`],
      ];
      info.forEach((row, ri) => {
        doc.text(row[0], 14, 26 + ri*5);
        doc.text(row[1], PW/2, 26 + ri*5);
      });

      // Marks table
      const gs = getActiveGradingSystem();
      const tableHead = [['#','Subject','Out Of','Score','Grade','Points','Remarks']];
      const tableBody = d.subjectRows.map((r,i)=>[i+1, r.name, r.max, r.score!==null?r.score:'—', r.grade, r.points, r.label]);
      const totalRow  = ['','TOTALS / MEAN', d.subjectRows.reduce((a,r)=>a+r.max,0), d.total, d.mGrade.grade, d.totalPoints, d.mGrade.label];

      doc.autoTable({
        startY: 44,
        head: tableHead,
        body: [...tableBody, totalRow],
        theme: 'striped',
        styles: { fontSize:8, cellPadding:1.8 },
        headStyles: { fillColor:[26,111,181], textColor:255, fontStyle:'bold' },
        alternateRowStyles: { fillColor:[240,247,255] },
        didParseCell: (data) => {
          if (data.row.index === tableBody.length) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220,238,255];
          }
        }
      });

      const afterTable = doc.lastAutoTable.finalY + 5;

      // Performance summary
      doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(26,111,181);
      doc.text('PERFORMANCE SUMMARY', 14, afterTable);
      doc.setTextColor(0,0,0); doc.setFont(undefined,'normal'); doc.setFontSize(8.5);
      const perfItems = [
        [`Stream Position: ${d.streamRank > 0 ? d.streamRank+' / '+students.filter(s=>s.streamId===stu.streamId).length : '—'}`,
         `Overall Position: ${d.overallRank > 0 ? d.overallRank+' / '+students.length : '—'}`],
        [`Mean Score: ${d.mean.toFixed(2)}`, `Total Points: ${d.totalPoints}`],
        [`Grade: ${d.mGrade.grade} — ${d.mGrade.label}`, ''],
      ];
      perfItems.forEach((row, ri) => {
        doc.text(row[0], 14, afterTable+6+ri*5);
        if (row[1]) doc.text(row[1], PW/2, afterTable+6+ri*5);
      });

      const afterPerf = afterTable + 6 + perfItems.length*5 + 5;

      // Remarks boxes
      doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(26,111,181);
      doc.text("CLASS TEACHER'S REMARKS", 14, afterPerf);
      doc.setTextColor(0,0,0); doc.setFont(undefined,'normal'); doc.setFontSize(8);
      const ctLines = doc.splitTextToSize(ctRemark||'…………………………………………………………', PW-28);
      doc.text(ctLines, 14, afterPerf+5);
      const afterCT = afterPerf + 5 + ctLines.length*4.5 + 3;
      doc.text('Signature: ……………………………  Date: …………………', 14, afterCT);

      const afterCTSig = afterCT + 8;
      doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(26,111,181);
      doc.text("PRINCIPAL'S REMARKS", 14, afterCTSig);
      doc.setTextColor(0,0,0); doc.setFont(undefined,'normal'); doc.setFontSize(8);
      const prLines = doc.splitTextToSize(prRemark||'…………………………………………………………', PW-28);
      doc.text(prLines, 14, afterCTSig+5);
      const afterPR = afterCTSig + 5 + prLines.length*4.5 + 3;
      doc.text('Signature: ……………………………  Date: …………………', 14, afterPR);

      // Fee info — per-student auto-lookup for this term, fall back to global manual override
      const rpTermOverride2 = document.getElementById('rpTerm')?.value || '';
      const rpYearOverride2 = document.getElementById('rpYear')?.value || '';
      const feeLookupTerm2 = rpTermOverride2 || (d.exam?.term) || '';
      const feeLookupYear2 = rpYearOverride2 || (d.exam?.year ? String(d.exam.year) : '');
      let stuFeeBalance  = ''; // will be filled by auto-lookup; feeBalance input is fallback only
      let stuFeeNextTerm = feeNextTerm;
      if (feeLookupTerm2 && feeLookupYear2) {
        {
          // Auto-lookup this student's balance for the current exam term
          loadFees();
          const feeData = getStudentFeeStatus(stu.id, feeLookupTerm2, feeLookupYear2);
          if (feeData.balance !== null) stuFeeBalance = String(feeData.balance);
          // feeBalance input is a fallback — only use if auto-lookup found nothing
          if (stuFeeBalance === '' && feeBalance !== '') stuFeeBalance = feeBalance;
        }
        if (feeNextTerm === '') {
          // Auto-lookup next-term fee amount from fee structures
          loadFees();
          const termMap = {'Term 1':'Term 2','Term 2':'Term 3','Term 3':'Term 1'};
          const nxtTerm = termMap[feeLookupTerm2] || feeLookupTerm2;
          const nxtYear = feeLookupTerm2==='Term 3' ? String(parseInt(feeLookupYear2)+1) : feeLookupYear2;
          const struct  = feeStructures.find(f => f.classId===stu.classId && f.term===nxtTerm && String(f.year)===nxtYear);
          if (struct) stuFeeNextTerm = String(struct.totalFee);
        }
      }
      if (stuFeeBalance !== '') {
        const afterPRSig = afterPR + 8;
        doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(26,111,181);
        doc.text('FEE STATEMENT', 14, afterPRSig);
        doc.setTextColor(0,0,0); doc.setFont(undefined,'normal'); doc.setFontSize(8.5);
        doc.text(`Fee Balance This Term: KES ${parseFloat(stuFeeBalance||0).toLocaleString()}`, 14, afterPRSig+5);
        if (stuFeeNextTerm !== '') doc.text(`Fees for Next Term: KES ${parseFloat(stuFeeNextTerm||0).toLocaleString()}`, PW/2, afterPRSig+5);
      }

      // Footer
      doc.setFillColor(240,247,255); doc.rect(0,PH-14,PW,14,'F');
      doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont(undefined,'normal');
      doc.text(`School Closed: ${schoolClosed||'……………'}  |  Next Term Opens: ${nextOpen||'……………'}`, 14, PH-7);
      doc.text(`Printed: ${new Date().toLocaleDateString()}`, PW-14, PH-7, {align:'right'});
    });

    const exam = exams.find(e=>e.id===examId);
    doc.save(`reports_${exam?.name||'exam'}_${stuList.length}students.pdf`);
    showToast(`PDF with ${stuList.length} report(s) downloaded ✓`,'success');
  } catch(err) {
    showToast('PDF generation error: '+err.message,'error');
    console.error(err);
  }
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  TIMETABLE MODULE v2
//  • Teacher colour system
//  • Stream view  (coloured by teacher)
//  • Teacher view (one teacher across all streams)
//  • Block view   (all streams side-by-side)
//  • Auto-generate (collision-safe scheduler)
//  • Collision checker
// ═══════════════════════════════════════════════

const K_TT      = 'ei_timetables';   // { "streamId_term_year": { Mo:{p1:{subject,teacher,isPPI},…},… } }
const K_TT_ALLOC = 'ei_tt_alloc';    // { streamId: { subjectCode: { tch, periods } } }
let timetables = {};
let ttAlloc    = {};

const TT_DAYS     = ['Mo','Tu','We','Th','Fr'];
const TT_DAY_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

const TT_PERIODS = [
  { id:'hc',  label:'HEALTH CHECK / ASSEMBLY / CLASS MEETING', time:'8:00–8:20',   isBreak:true,  breakLabel:'HEALTH CHECK / ASSEMBLY/ CLASS MEETING' },
  { id:'p1',  label:'Period 1', time:'8:20–9:00',    isBreak:false },
  { id:'p2',  label:'Period 2', time:'9:00–9:40',    isBreak:false },
  { id:'sb',  label:'SHORT BREAK', time:'9:40–9:50', isBreak:true,  breakLabel:'S H O R T   B R E A K' },
  { id:'p3',  label:'Period 3', time:'9:50–10:30',   isBreak:false },
  { id:'p4',  label:'Period 4', time:'10:30–11:10',  isBreak:false },
  { id:'lb',  label:'LONG BREAK', time:'11:10–11:30',isBreak:true,  breakLabel:'L O N G   B R E A K' },
  { id:'p5',  label:'Period 5', time:'11:30–12:10',  isBreak:false },
  { id:'p6',  label:'Period 6', time:'12:10–12:50',  isBreak:false },
  { id:'lun', label:'LUNCH', time:'12:50–14:00',     isBreak:true,  breakLabel:'L U N C H' },
  { id:'p7',  label:'Period 7', time:'14:00–14:40',  isBreak:false },
  { id:'p8',  label:'Period 8', time:'14:40–15:20',  isBreak:false },
];

const TT_LESSON_PERIODS = TT_PERIODS.filter(p=>!p.isBreak).map(p=>p.id); // p1..p8
const TT_PERIOD_NUMS    = {};
TT_LESSON_PERIODS.forEach((id,i)=>{ TT_PERIOD_NUMS[id]=i+1; });

// ── Teacher colour index ──────────────────────────────────
// Returns a stable CSS class 'tch-N' for a teacher name/initials
const _tchColorMap = {};
let   _tchColorNext = 0;
function tchColorClass(tchName) {
  if (!tchName) return 'tt-c-def';
  if (!_tchColorMap[tchName]) {
    _tchColorMap[tchName] = `tch-${_tchColorNext % 16}`;
    _tchColorNext++;
  }
  return _tchColorMap[tchName];
}
function tchBgColor(tchName) {
  // Return inline hex for print/PDF where CSS classes don't work
  const PALETTE = ['#dbeafe','#d1fae5','#ede9fe','#fce7f3','#fef3c7','#ffedd5','#dcfce7','#f0fdf4','#e0f2fe','#f3e8ff','#fdf2f8','#ecfdf5','#fff7ed','#fef2f2','#f0f9ff','#fafaf9'];
  const TEXT    = ['#1e40af','#065f46','#5b21b6','#831843','#92400e','#9a3412','#14532d','#166534','#0c4a6e','#6b21a8','#9d174d','#064e3b','#7c2d12','#7f1d1d','#0c4a6e','#292524'];
  const idx     = Object.keys(_tchColorMap).indexOf(tchName);
  if (idx < 0) return { bg:'#f3f4f6', text:'#374151' };
  const i = idx % 16;
  return { bg: PALETTE[i], text: TEXT[i] };
}

// ── Build teacher legend HTML ─────────────────────────────
function buildTeacherLegend() {
  const entries = Object.entries(_tchColorMap);
  if (!entries.length) return '';
  const items = entries.map(([name, cls]) => {
    const c = tchBgColor(name);
    return `<span class="tt-legend-item"><span class="tt-legend-swatch ${cls}" style="background:${c.bg};border:2px solid ${c.text}"></span>${name}</span>`;
  }).join('');
  return `<div class="tt-teacher-legend">${items}</div>`;
}

// ── Subject colour (fallback when no teacher) ────────────
function ttSubjectColour(code) {
  if (!code) return 'tt-c-def';
  const c = code.toUpperCase();
  if (c.includes('ENG'))                        return 'tt-c-eng';
  if (c.includes('KIS')||c.includes('KISW'))    return 'tt-c-kisw';
  if (c.includes('MATH')||c.includes('MTH'))    return 'tt-c-math';
  if (c.includes('INT')||c.includes('SCI'))     return 'tt-c-sci';
  if (c.includes('S.S')||c.includes('SST'))     return 'tt-c-ss';
  if (c.includes('CRE')||c.includes('IRE'))     return 'tt-c-cre';
  if (c.includes('AGR')||c.includes('NUT'))     return 'tt-c-agr';
  if (c.includes('PRE')||c.includes('TECH'))    return 'tt-c-prt';
  if (c.includes('CASP')||c.includes('CSP'))    return 'tt-c-casp';
  return 'tt-c-def';
}

// ── Storage helpers ───────────────────────────────────────
function loadTimetables() {
  try { timetables = JSON.parse(localStorage.getItem(K_TT)) || {}; } catch { timetables = {}; }
  try { ttAlloc    = JSON.parse(localStorage.getItem(K_TT_ALLOC)) || {}; } catch { ttAlloc = {}; }
  // Rebuild colour map from all stored teacher initials
  Object.values(timetables).forEach(grid => {
    TT_DAYS.forEach(day => {
      TT_LESSON_PERIODS.forEach(pid => {
        const tch = grid[day]?.[pid]?.teacher;
        if (tch) tchColorClass(tch);
      });
    });
  });
}
function saveTimetables() {
  localStorage.setItem(K_TT, JSON.stringify(timetables));
  localStorage.setItem(K_TT_ALLOC, JSON.stringify(ttAlloc));
}
function ttKey(streamId, term, year) { return `${streamId}_${term}_${year}`; }

function getTimetable(streamId, term, year) {
  const key = ttKey(streamId, term, year);
  if (!timetables[key]) {
    timetables[key] = {};
    TT_DAYS.forEach(day => {
      timetables[key][day] = {};
      TT_LESSON_PERIODS.forEach(pid => {
        timetables[key][day][pid] = { subject:'', teacher:'', isPPI:false };
      });
    });
  }
  return timetables[key];
}

// ── Tab switching ─────────────────────────────────────────
function openTTTab(tabId, btn) {
  document.querySelectorAll('#s-timetable .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#ttTabBar .tb').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(tabId);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'ttTabTeacher') { populateTtTeacherDropdown(); renderTeacherTimetable(); }
  if (tabId === 'ttTabBlock')   { renderBlockTimetable(); }
  if (tabId === 'ttTabAuto')    { loadAutoAllocUI(); }
}

// ── Stream dropdown ───────────────────────────────────────
function populateTtStreamDropdown() {
  const el = document.getElementById('ttStreamSel'); if (!el) return;
  el.innerHTML = '<option value="">— Select Stream —</option>' +
    streams.map(s => {
      const cls = classes.find(c=>c.id===s.classId);
      return `<option value="${s.id}">${cls?.name||''} ${s.name}</option>`;
    }).join('');
}
function populateTtTeacherDropdown() {
  const el = document.getElementById('ttTeacherSel'); if (!el) return;
  el.innerHTML = '<option value="">— Select Teacher —</option>' +
    teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}
function populateTtAutoScope() {
  const el = document.getElementById('ttAutoScope'); if (!el) return;
  el.innerHTML = '<option value="all">All Streams</option>' +
    streams.map(s => {
      const cls = classes.find(c=>c.id===s.classId);
      return `<option value="${s.id}">${cls?.name||''} ${s.name}</option>`;
    }).join('');
}

// ═══════════════════════════════════════════════════════════
//  STREAM VIEW
// ═══════════════════════════════════════════════════════════
function renderTimetable() {
  const streamId = document.getElementById('ttStreamSel')?.value;
  const term     = document.getElementById('ttTerm')?.value;
  const year     = document.getElementById('ttYear')?.value;
  const wrap     = document.getElementById('ttDisplay');
  if (!wrap) return;

  if (!streamId) { wrap.innerHTML = '<div class="card" style="text-align:center;padding:2.5rem;color:var(--muted)">Select a stream to view its timetable.</div>'; return; }

  const stream    = streams.find(s=>s.id===streamId);
  const cls       = classes.find(c=>c.id===stream?.classId);
  const ctTeacher = teachers.find(t=>t.id===stream?.streamTeacherId);
  const grid      = getTimetable(streamId, term, year);

  // Register teachers in colour map
  TT_DAYS.forEach(day => TT_LESSON_PERIODS.forEach(pid => {
    const tch = grid[day]?.[pid]?.teacher;
    if (tch) tchColorClass(tch);
  }));

  const periodHeaders = TT_PERIODS.map(p => {
    if (p.isBreak) return `<th class="tt-break-col">${p.breakLabel}</th>`;
    return `<th><span class="tt-period-num">${TT_PERIOD_NUMS[p.id]}</span><span class="tt-time-hdr">${p.time}</span></th>`;
  }).join('');

  const bodyRows = TT_DAYS.map(day => {
    const dayCells = TT_PERIODS.map(p => {
      if (p.isBreak) return '';
      const cell   = grid[day]?.[p.id] || { subject:'', teacher:'', isPPI:false };
      if (cell.isPPI || cell.subject==='PPI') {
        return `<td class="tt-cell" onclick="openCellEditor('${streamId}','${term}','${year}','${day}','${p.id}')">
          <span class="tt-ppi">PPI</span>
        </td>`;
      }
      // Use teacher colour if teacher assigned, else subject colour
      const colCls = cell.teacher ? tchColorClass(cell.teacher) : ttSubjectColour(cell.subject);
      return `<td class="tt-cell ${!cell.subject?'tt-empty':''}" onclick="openCellEditor('${streamId}','${term}','${year}','${day}','${p.id}')">
        ${cell.subject ? `<span class="tt-subj-chip ${colCls}">${cell.subject}</span>` : ''}
        ${cell.teacher ? `<div class="tt-teacher">${cell.teacher}</div>` : ''}
        ${!cell.subject && !cell.teacher ? '<span style="color:var(--border);font-size:.7rem">—</span>' : ''}
      </td>`;
    }).join('');
    return `<tr><td class="tt-day-col">${day}</td>${dayCells}</tr>`;
  }).join('');

  wrap.innerHTML = `
  <div class="tt-wrap" id="ttPrintable">
    <div class="tt-school-header">
      <div>
        <h2></h2>
        <p>TIMETABLE FOR ${(term||'').toUpperCase()} ${year}</p>
      </div>
      <div style="text-align:right">
        <div style="font-weight:800;font-size:.95rem">${cls?.name||''} ${stream?.name||''}</div>
        <div style="font-size:.75rem;opacity:.85">Class Teacher: ${ctTeacher?.name||'—'}</div>
        <div style="font-size:.7rem;opacity:.75;font-style:italic">MOTTO: YES WE CAN</div>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="tt-table">
        <thead><tr><th style="width:48px">Day</th>${periodHeaders}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    ${buildTeacherLegend()}
    <div style="padding:.5rem 1rem;font-size:.7rem;color:var(--muted);text-align:right;border-top:1px solid var(--border)">
      Charanas Analyzer · ${settings.schoolName||''} · Printed: ${new Date().toLocaleDateString()}
    </div>
  </div>`;
}

// ── Cell editor ──────────────────────────────────────────
function openCellEditor(streamId, term, year, day, periodId) {
  const grid   = getTimetable(streamId, term, year);
  const cell   = grid[day]?.[periodId] || { subject:'', teacher:'', isPPI:false };
  const period = TT_PERIODS.find(p=>p.id===periodId);
  const dayFull= TT_DAY_FULL[TT_DAYS.indexOf(day)];

  const subjectOpts = [
    { code:'', label:'— Empty —' },
    ...subjects.map(s=>({ code:s.code, label:`${s.code} — ${s.name}` })),
    { code:'CASP', label:'CASP — Computer & AI Skills' },
    { code:'PPI',  label:'PPI — Pastoral & Personal Interaction' },
  ].filter((v,i,a)=>a.findIndex(x=>x.code===v.code)===i);

  const teacherOpts = ['<option value="">— Select Teacher —</option>',
    ...teachers.map(t=>`<option value="${t.name}" ${cell.teacher===t.name?'selected':''}>${t.name}</option>`)
  ].join('');

  const subOpts = subjectOpts.map(o=>
    `<option value="${o.code}" ${cell.subject===o.code?'selected':''}>${o.label||o.code}</option>`
  ).join('');

  showModal(
    `✏️ Edit Cell — ${dayFull} · ${period?.time||periodId}`,
    `<div class="tt-edit-cell-form">
      <div><label>Subject</label><select id="ttCellSubj">${subOpts}</select></div>
      <div><label>Teacher Initials / Code</label><input type="text" id="ttCellTeacherCode" value="${cell.teacher||''}" placeholder="e.g. SW, MG, EA"/></div>
      <div><label>Or pick teacher from list</label><select id="ttCellTeacherPick" onchange="syncTeacherCode()">${teacherOpts}</select></div>
      <div><label style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="ttCellPPI" ${cell.isPPI?'checked':''}/> Mark as PPI</label></div>
    </div>`,
    [
      { label:'💾 Save', cls:'btn-primary', action:`saveCellEdit('${streamId}','${term}','${year}','${day}','${periodId}')` },
      { label:'🗑 Clear', cls:'btn-outline', action:`clearCell('${streamId}','${term}','${year}','${day}','${periodId}')` },
      { label:'Cancel', cls:'btn-outline', action:'closeModal()' },
    ]
  );
}
function syncTeacherCode() {
  const pick = document.getElementById('ttCellTeacherPick')?.value;
  const inp  = document.getElementById('ttCellTeacherCode');
  if (pick && inp) inp.value = pick.split(' ').map(w=>w[0]).slice(0,2).join('');
}
function saveCellEdit(streamId, term, year, day, periodId) {
  const grid    = getTimetable(streamId, term, year);
  const subj    = document.getElementById('ttCellSubj')?.value||'';
  const teacher = document.getElementById('ttCellTeacherCode')?.value.trim()||'';
  const isPPI   = document.getElementById('ttCellPPI')?.checked||false;
  if (!grid[day]) grid[day] = {};
  grid[day][periodId] = { subject: isPPI?'PPI':subj, teacher, isPPI };
  if (teacher) tchColorClass(teacher);
  timetables[ttKey(streamId,term,year)] = grid;
  saveTimetables(); closeModal(); renderTimetable();
  showToast('Cell saved ✓','success');
}
function clearCell(streamId, term, year, day, periodId) {
  const grid = getTimetable(streamId, term, year);
  if (!grid[day]) grid[day] = {};
  grid[day][periodId] = { subject:'', teacher:'', isPPI:false };
  timetables[ttKey(streamId,term,year)] = grid;
  saveTimetables(); closeModal(); renderTimetable();
  showToast('Cell cleared','info');
}

// ── Bulk editor ──────────────────────────────────────────
function openTimetableEditor() {
  const streamId = document.getElementById('ttStreamSel')?.value;
  if (!streamId) { showToast('Select a stream first','error'); return; }
  const term   = document.getElementById('ttTerm').value;
  const year   = document.getElementById('ttYear').value;
  const grid   = getTimetable(streamId, term, year);
  const stream = streams.find(s=>s.id===streamId);
  const cls    = classes.find(c=>c.id===stream?.classId);

  const colHeaders = TT_LESSON_PERIODS.map((pid,i)=>{
    const p = TT_PERIODS.find(x=>x.id===pid);
    return `<th style="font-size:.7rem;text-align:center;min-width:90px">P${i+1}<br><span style="font-weight:400;color:var(--muted)">${p.time}</span></th>`;
  }).join('');

  const subjectOptions = [
    '<option value="">—</option>',
    ...subjects.map(s=>`<option value="${s.code}">${s.code}</option>`),
    '<option value="CASP">CASP</option>',
    '<option value="PPI">PPI</option>',
  ].filter((v,i,a)=>a.indexOf(v)===i).join('');

  const teacherList = [...new Set(teachers.map(t=>t.name))];
  const teacherOptions = ['<option value="">—</option>', ...teacherList.map(n=>`<option value="${n.split(' ').map(w=>w[0]).slice(0,2).join('')}">${n.split(' ').map(w=>w[0]).slice(0,2).join('')} — ${n}</option>`)].join('');

  const rows = TT_DAYS.map(day => {
    const cells = TT_LESSON_PERIODS.map(pid => {
      const cell = grid[day]?.[pid]||{};
      const subOpts = subjectOptions.replace(`value="${cell.subject}"`, `value="${cell.subject}" selected`);
      return `<td style="text-align:center;padding:2px">
        <select class="tt-bulk-subj" data-day="${day}" data-pid="${pid}" style="width:72px;font-size:.72rem;padding:2px">${subOpts}</select>
        <input type="text" class="tt-bulk-tch" data-day="${day}" data-pid="${pid}" value="${cell.teacher||''}" placeholder="TCH" style="width:40px;font-size:.72rem;padding:2px;margin-top:2px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text)"/>
      </td>`;
    }).join('');
    return `<tr><td style="font-weight:700;padding:4px 8px;font-size:.82rem">${day}</td>${cells}</tr>`;
  }).join('');

  showModal(
    `✏️ Bulk Edit — ${cls?.name||''} ${stream?.name||''} · ${term} ${year}`,
    `<p style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">Edit subjects and teacher initials directly. Click Save when done.</p>
    <div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:.8rem">
      <thead><tr><th style="padding:4px 8px">Day</th>${colHeaders}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`,
    [
      { label:'💾 Save All', cls:'btn-primary', action:`saveBulkTimetable('${streamId}','${term}','${year}')` },
      { label:'🗑 Clear All', cls:'btn-danger-sm', action:`clearTimetable('${streamId}','${term}','${year}')` },
      { label:'Cancel', cls:'btn-outline', action:'closeModal()' },
    ]
  );
}
function saveBulkTimetable(streamId, term, year) {
  const grid = getTimetable(streamId, term, year);
  document.querySelectorAll('.tt-bulk-subj').forEach(sel => {
    const {day, pid} = sel.dataset;
    const subj = sel.value;
    const tchInp = document.querySelector(`.tt-bulk-tch[data-day="${day}"][data-pid="${pid}"]`);
    const tch = tchInp ? tchInp.value.trim() : '';
    if (!grid[day]) grid[day] = {};
    grid[day][pid] = { subject:subj, teacher:tch, isPPI:subj==='PPI' };
    if (tch) tchColorClass(tch);
  });
  timetables[ttKey(streamId,term,year)] = grid;
  saveTimetables(); closeModal(); renderTimetable();
  showToast('Timetable saved ✓','success');
}
function clearTimetable(streamId, term, year) {
  if (!confirm('Clear the entire timetable for this stream and term?')) return;
  delete timetables[ttKey(streamId,term,year)];
  saveTimetables(); closeModal(); renderTimetable();
  showToast('Timetable cleared','info');
}

// ── Print stream timetable ───────────────────────────────
function printTimetable() {
  const wrap = document.getElementById('ttPrintable');
  if (!wrap) { showToast('Generate a timetable first','error'); return; }
  const pw = window.open('','_blank','width=1200,height=800');
  pw.document.write(buildPrintHTMLShell(wrap.outerHTML, _buildPrintStyles()));
  pw.document.close();
  setTimeout(()=>{ pw.focus(); pw.print(); pw.close(); }, 400);
}
function _buildPrintStyles() {
  const PALETTE = ['#dbeafe','#d1fae5','#ede9fe','#fce7f3','#fef3c7','#ffedd5','#dcfce7','#f0fdf4','#e0f2fe','#f3e8ff','#fdf2f8','#ecfdf5','#fff7ed','#fef2f2','#f0f9ff','#fafaf9'];
  const TEXT    = ['#1e40af','#065f46','#5b21b6','#831843','#92400e','#9a3412','#14532d','#166534','#0c4a6e','#6b21a8','#9d174d','#064e3b','#7c2d12','#7f1d1d','#0c4a6e','#292524'];
  const tchClasses = Object.entries(_tchColorMap).map(([,cls], i) => {
    const idx = parseInt(cls.split('-')[1]);
    return `.${cls}{background:${PALETTE[idx]};color:${TEXT[idx]};border-left:3px solid ${TEXT[idx]};}`;
  }).join('');
  return `* { box-sizing:border-box; font-family:Arial,sans-serif; }
    body { margin:0; padding:1rem; background:#fff; color:#000; }
    table { width:100%; border-collapse:collapse; font-size:9pt; }
    th, td { border:1px solid #cbd5e1; padding:3px; text-align:center; vertical-align:middle; }
    thead th { background:#1a6fb5; color:#fff; font-weight:700; font-size:8pt; }
    .tt-day-col { background:#1a6fb5; color:#fff; font-weight:800; font-size:10pt; width:40px; }
    .tt-break-col { background:#f1f5f9; color:#64748b; font-size:7pt; font-weight:700; writing-mode:vertical-rl; transform:rotate(180deg); width:18px; }
    .tt-subj-chip { display:inline-block; border-radius:3px; padding:1px 5px; font-weight:700; font-size:8.5pt; }
    .tt-teacher { font-size:7pt; color:#1a6fb5; font-weight:600; }
    .tt-ppi { background:#fef3c7; border-radius:3px; padding:1px 4px; font-size:7.5pt; font-weight:700; color:#92400e; }
    .tt-school-header { background:#1a6fb5; color:#fff; padding:.4rem .75rem; display:flex; justify-content:space-between; }
    .tt-school-header h2 { margin:0; font-size:10pt; font-weight:800; }
    .tt-school-header p { margin:0; font-size:7.5pt; }
    .tt-teacher-legend { display:flex; flex-wrap:wrap; gap:.4rem; padding:.5rem; border-top:1px solid #e2e8f0; }
    .tt-legend-item { display:flex; align-items:center; gap:.3rem; font-size:7pt; font-weight:600; }
    .tt-legend-swatch { width:12px; height:12px; border-radius:2px; }
    .tt-c-eng{background:#dbeafe;color:#1e40af} .tt-c-kisw{background:#d1fae5;color:#065f46}
    .tt-c-math{background:#ede9fe;color:#5b21b6} .tt-c-sci{background:#dcfce7;color:#14532d}
    .tt-c-ss{background:#fef9c3;color:#713f12} .tt-c-cre{background:#fce7f3;color:#831843}
    .tt-c-agr{background:#d1fae5;color:#065f46} .tt-c-prt{background:#ffedd5;color:#9a3412}
    .tt-c-casp{background:#e0f2fe;color:#0c4a6e} .tt-c-def{background:#f3f4f6;color:#374151}
    ${tchClasses}`;
}
function buildPrintHTMLShell(body, css) {
  return `<html><head><style>${css}</style></head><body>${body}</body></html>`;
}

// ── PDF export stream timetable ──────────────────────────
function exportTimetablePDF() {
  const streamId = document.getElementById('ttStreamSel')?.value;
  if (!streamId) { showToast('Select a stream first','error'); return; }
  const term     = document.getElementById('ttTerm').value;
  const year     = document.getElementById('ttYear').value;
  const grid     = getTimetable(streamId, term, year);
  const stream   = streams.find(s=>s.id===streamId);
  const cls      = classes.find(c=>c.id===stream?.classId);
  const ctTch    = teachers.find(t=>t.id===stream?.streamTeacherId);
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const PW  = doc.internal.pageSize.getWidth();
    const PH  = doc.internal.pageSize.getHeight();
    doc.setFillColor(26,111,181); doc.rect(0,0,PW,16,'F');
    doc.setFontSize(12); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
    doc.text('', 14, 7);
    doc.setFontSize(9); doc.setFont(undefined,'normal');
    doc.text(`TIMETABLE FOR ${(term||'').toUpperCase()} ${year}`, 14, 13);
    doc.setFontSize(11); doc.setFont(undefined,'bold');
    doc.text(`${cls?.name||''} ${stream?.name||''}`, PW-14, 8, {align:'right'});
    doc.setFontSize(8); doc.setFont(undefined,'normal');
    doc.text(`Class Teacher: ${ctTch?.name||'—'}  |  MOTTO: YES WE CAN`, PW-14, 14, {align:'right'});
    doc.setTextColor(0,0,0);
    const head = [['Day', ...TT_PERIODS.map(p => p.isBreak ? p.breakLabel : `P${TT_PERIOD_NUMS[p.id]}\n${p.time}`)]];
    const body = TT_DAYS.map(day => [day, ...TT_PERIODS.map(p => {
      if (p.isBreak) return '';
      const cell = grid[day]?.[p.id]||{};
      if (cell.isPPI || cell.subject==='PPI') return 'PPI';
      return cell.subject ? `${cell.subject}${cell.teacher?'\n'+cell.teacher:''}` : '';
    })]);
    const breakCols = TT_PERIODS.reduce((acc,p,i)=>{ if(p.isBreak) acc[i+1]={cellWidth:8}; return acc; },{});
    doc.autoTable({
      startY:20, head, body, theme:'grid',
      styles:{ fontSize:7.5, cellPadding:2, halign:'center', valign:'middle', lineColor:[203,213,225], lineWidth:0.3 },
      headStyles:{ fillColor:[26,111,181], textColor:255, fontStyle:'bold', fontSize:7, halign:'center', cellPadding:1.5 },
      alternateRowStyles:{ fillColor:[240,247,255] },
      columnStyles:{ 0:{ cellWidth:12, fontStyle:'bold', fillColor:[26,111,181], textColor:255 }, ...breakCols },
      didParseCell(data) {
        const pIdx = data.column.index - 1;
        if (pIdx >= 0 && TT_PERIODS[pIdx]?.isBreak && data.section !== 'head') {
          data.cell.styles.fillColor = [241,245,249];
          data.cell.styles.textColor = [100,116,139];
          data.cell.styles.fontSize  = 5.5;
        }
        if (data.section !== 'head' && data.column.index > 0) {
          const pId = TT_LESSON_PERIODS[TT_PERIODS.filter(p=>!p.isBreak).findIndex((_,fi)=>{
            return TT_PERIODS.filter(p=>!p.isBreak)[fi]?.id === TT_LESSON_PERIODS[data.column.index - 1 - TT_PERIODS.slice(0,data.column.index).filter(p=>p.isBreak).length];
          })];
        }
      }
    });
    doc.setFontSize(7); doc.setTextColor(150,150,150);
    doc.text(`Printed: ${new Date().toLocaleDateString()} | Charanas Analyzer | ${settings.schoolName||''}`, PW/2, PH-5, {align:'center'});
    doc.save(`timetable_${cls?.name||''}_${stream?.name||''}_${term}_${year}.pdf`.replace(/\s+/g,'_'));
    showToast('Timetable PDF downloaded ✓','success');
  } catch(err) { showToast('PDF error: '+err.message,'error'); console.error(err); }
}

// ═══════════════════════════════════════════════════════════
//  TEACHER VIEW
// ═══════════════════════════════════════════════════════════
function renderTeacherTimetable() {
  const tchId  = document.getElementById('ttTeacherSel')?.value;
  const term   = document.getElementById('ttTeacherTerm')?.value;
  const year   = document.getElementById('ttTeacherYear')?.value;
  const wrap   = document.getElementById('ttTeacherDisplay');
  if (!wrap) return;

  if (!tchId) { wrap.innerHTML = '<div class="card" style="text-align:center;padding:2.5rem;color:var(--muted)">Select a teacher to view their schedule.</div>'; return; }

  const teacher = teachers.find(t=>t.id===tchId);
  if (!teacher) return;
  // Teacher initials — what they would appear as in cells
  const tchInitials = teacher.name.split(' ').map(w=>w[0]).slice(0,2).join('');

  // Build lookup: for each day+period, which stream has this teacher?
  // We search by full name and initials
  const schedule = {}; // day -> { pid -> { streamName, subject } }
  TT_DAYS.forEach(day => {
    schedule[day] = {};
    TT_LESSON_PERIODS.forEach(pid => {
      streams.forEach(s => {
        const cls = classes.find(c=>c.id===s.classId);
        const grid = getTimetable(s.id, term, year);
        const cell = grid[day]?.[pid];
        if (cell && cell.teacher && (
          cell.teacher === teacher.name ||
          cell.teacher === tchInitials ||
          cell.teacher.toUpperCase() === tchInitials.toUpperCase()
        )) {
          schedule[day][pid] = { streamName:`${cls?.name||''} ${s.name}`, subject:cell.subject };
        }
      });
    });
  });

  const tchCls = tchColorClass(tchInitials);

  const periodHeaders = TT_PERIODS.map(p => {
    if (p.isBreak) return `<th class="tt-break-col">${p.breakLabel}</th>`;
    return `<th><span class="tt-period-num">${TT_PERIOD_NUMS[p.id]}</span><span class="tt-time-hdr">${p.time}</span></th>`;
  }).join('');

  const bodyRows = TT_DAYS.map(day => {
    const cells = TT_PERIODS.map(p => {
      if (p.isBreak) return '';
      const entry = schedule[day][p.id];
      if (!entry) return `<td class="tt-cell tt-empty"><span style="color:var(--border);font-size:.7rem">—</span></td>`;
      if (entry.subject === 'PPI') return `<td class="tt-cell"><span class="tt-ppi">PPI</span></td>`;
      return `<td class="tt-cell">
        <span class="tt-subj-chip ${tchCls}">${entry.subject}</span>
        <div class="tt-teacher" style="font-size:.65rem;color:var(--muted)">${entry.streamName}</div>
      </td>`;
    }).join('');
    return `<tr><td class="tt-day-col">${day}</td>${cells}</tr>`;
  }).join('');

  // Count teaching periods
  let totalPeriods = 0;
  TT_DAYS.forEach(d => { totalPeriods += Object.keys(schedule[d]).length; });

  wrap.innerHTML = `
  <div class="tt-tch-wrap" id="ttTeacherPrintable">
    <div class="tt-tch-header">
      <div>
        <h2 style="margin:0;font-size:1rem;font-weight:800">TEACHER TIMETABLE — ${teacher.name.toUpperCase()}</h2>
        <p style="margin:0;font-size:.78rem;opacity:.85"> · ${(term||'').toUpperCase()} ${year}</p>
      </div>
      <div style="text-align:right;font-size:.78rem">
        <div style="font-weight:700">Total Periods/Week: ${totalPeriods}</div>
        <div style="opacity:.8">MOTTO: YES WE CAN</div>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="tt-table">
        <thead><tr><th style="width:48px">Day</th>${periodHeaders}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div style="padding:.5rem 1rem;font-size:.7rem;color:var(--muted);text-align:right;border-top:1px solid var(--border)">
      Charanas Analyzer · ${settings.schoolName||''} · Printed: ${new Date().toLocaleDateString()}
    </div>
  </div>`;
}

function printTeacherTimetable() {
  const wrap = document.getElementById('ttTeacherPrintable');
  if (!wrap) { showToast('Generate a teacher timetable first','error'); return; }
  const pw = window.open('','_blank','width=1200,height=800');
  pw.document.write(buildPrintHTMLShell(wrap.outerHTML, _buildPrintStyles()));
  pw.document.close();
  setTimeout(()=>{ pw.focus(); pw.print(); pw.close(); }, 400);
}

function exportTeacherTimetablePDF() {
  const tchId  = document.getElementById('ttTeacherSel')?.value;
  const term   = document.getElementById('ttTeacherTerm')?.value;
  const year   = document.getElementById('ttTeacherYear')?.value;
  if (!tchId) { showToast('Select a teacher first','error'); return; }
  const teacher = teachers.find(t=>t.id===tchId);
  const tchInitials = teacher.name.split(' ').map(w=>w[0]).slice(0,2).join('');

  const schedule = {};
  TT_DAYS.forEach(day => {
    schedule[day] = {};
    TT_LESSON_PERIODS.forEach(pid => {
      streams.forEach(s => {
        const cls = classes.find(c=>c.id===s.classId);
        const grid = getTimetable(s.id, term, year);
        const cell = grid[day]?.[pid];
        if (cell?.teacher && (cell.teacher===teacher.name||cell.teacher===tchInitials||cell.teacher.toUpperCase()===tchInitials.toUpperCase())) {
          schedule[day][pid] = { streamName:`${cls?.name||''} ${s.name}`, subject:cell.subject };
        }
      });
    });
  });

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    doc.setFillColor(26,111,181); doc.rect(0,0,PW,16,'F');
    doc.setFontSize(12); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
    doc.text(`TEACHER TIMETABLE — ${teacher.name.toUpperCase()}`, 14, 7);
    doc.setFontSize(9); doc.setFont(undefined,'normal');
    doc.text(` · ${(term||'').toUpperCase()} ${year}`, 14, 13);
    doc.setTextColor(0,0,0);
    const head = [['Day', ...TT_PERIODS.map(p => p.isBreak ? p.breakLabel : `P${TT_PERIOD_NUMS[p.id]}\n${p.time}`)]];
    const body = TT_DAYS.map(day => [day, ...TT_PERIODS.map(p => {
      if (p.isBreak) return '';
      const e = schedule[day][p.id];
      return e ? `${e.subject}\n${e.streamName}` : '';
    })]);
    const breakCols = TT_PERIODS.reduce((acc,p,i)=>{ if(p.isBreak) acc[i+1]={cellWidth:8}; return acc; },{});
    doc.autoTable({ startY:20, head, body, theme:'grid',
      styles:{ fontSize:7.5, cellPadding:2, halign:'center', valign:'middle' },
      headStyles:{ fillColor:[26,111,181], textColor:255, fontStyle:'bold', fontSize:7 },
      alternateRowStyles:{ fillColor:[240,247,255] },
      columnStyles:{ 0:{ cellWidth:12, fontStyle:'bold', fillColor:[26,111,181], textColor:255 }, ...breakCols }
    });
    doc.save(`teacher_timetable_${teacher.name.replace(/\s+/g,'_')}_${term}_${year}.pdf`);
    showToast('Teacher timetable PDF downloaded ✓','success');
  } catch(err) { showToast('PDF error: '+err.message,'error'); }
}

// ═══════════════════════════════════════════════════════════
//  BLOCK VIEW
// ═══════════════════════════════════════════════════════════
function renderBlockTimetable() {
  const term   = document.getElementById('ttBlockTerm')?.value;
  const year   = document.getElementById('ttBlockYear')?.value;
  const viewBy = document.getElementById('ttBlockViewBy')?.value || 'day';
  const wrap   = document.getElementById('ttBlockDisplay');
  if (!wrap) return;

  if (!streams.length) { wrap.innerHTML = '<div class="card" style="text-align:center;padding:2rem;color:var(--muted)">No streams configured.</div>'; return; }

  if (viewBy === 'day') {
    _renderBlockByDay(wrap, term, year);
  } else {
    _renderBlockSideBySide(wrap, term, year);
  }
}

function _renderBlockByDay(wrap, term, year) {
  let html = `<div class="tt-wrap" id="ttBlockPrintable"><div class="tt-school-header">
    <div><h2>BLOCK TIMETABLE — ALL STREAMS</h2><p> · ${(term||'').toUpperCase()} ${year}</p></div>
    <div style="text-align:right;font-size:.78rem;opacity:.9">MOTTO: YES WE CAN</div>
  </div>`;

  TT_DAYS.forEach((day, di) => {
    html += `<div style="overflow-x:auto;border-top:2px solid var(--primary)">
      <div style="background:var(--primary);color:#fff;font-weight:800;padding:.35rem 1rem;font-size:.85rem">${TT_DAY_FULL[di]}</div>
      <table class="tt-block-table" style="width:100%">
        <thead><tr>
          <th style="width:120px">Stream</th>
          ${TT_LESSON_PERIODS.map((pid,i)=>`<th>P${i+1}<br><span style="font-weight:400;font-size:.65rem">${TT_PERIODS.find(p=>p.id===pid).time}</span></th>`).join('')}
        </tr></thead>
        <tbody>`;

    streams.forEach(s => {
      const cls  = classes.find(c=>c.id===s.classId);
      const grid = getTimetable(s.id, term, year);
      html += `<tr>
        <td class="tt-block-stream-hdr">${cls?.name||''} ${s.name}</td>
        ${TT_LESSON_PERIODS.map(pid => {
          const cell = grid[day]?.[pid] || {};
          if (cell.isPPI || cell.subject==='PPI') return `<td><span class="tt-ppi">PPI</span></td>`;
          if (!cell.subject) return `<td style="color:var(--border)">—</td>`;
          const colCls = cell.teacher ? tchColorClass(cell.teacher) : ttSubjectColour(cell.subject);
          return `<td><span class="tt-subj-chip ${colCls}">${cell.subject}</span>${cell.teacher?`<div class="tt-teacher">${cell.teacher}</div>`:''}</td>`;
        }).join('')}
      </tr>`;
    });

    html += `</tbody></table></div>`;
  });

  html += buildTeacherLegend();
  html += `<div style="padding:.5rem 1rem;font-size:.7rem;color:var(--muted);text-align:right;border-top:1px solid var(--border)">
    Charanas Analyzer · ${settings.schoolName||''} · Printed: ${new Date().toLocaleDateString()}
  </div></div>`;
  wrap.innerHTML = html;
}

function _renderBlockSideBySide(wrap, term, year) {
  // Columns: Period | Stream1 | Stream2 | ...
  const streamCols = streams.map(s => {
    const cls = classes.find(c=>c.id===s.classId);
    return `${cls?.name||''} ${s.name}`;
  });

  let html = `<div class="tt-wrap" id="ttBlockPrintable"><div class="tt-school-header">
    <div><h2>BLOCK TIMETABLE — ALL STREAMS SIDE-BY-SIDE</h2><p> · ${(term||'').toUpperCase()} ${year}</p></div>
    <div style="text-align:right;font-size:.78rem;opacity:.9">MOTTO: YES WE CAN</div>
  </div><div style="overflow-x:auto"><table class="tt-block-table" style="width:100%"><thead>
    <tr><th>Day</th><th>Period</th>${streamCols.map(n=>`<th>${n}</th>`).join('')}</tr>
  </thead><tbody>`;

  TT_DAYS.forEach((day, di) => {
    TT_LESSON_PERIODS.forEach((pid, pi) => {
      const p = TT_PERIODS.find(x=>x.id===pid);
      // insert break rows
      if (pi === 2) html += `<tr><td colspan="${2+streams.length}" style="background:var(--border-lt);color:var(--muted);font-size:.65rem;font-weight:700;text-align:center;padding:3px">SHORT BREAK 9:40–9:50</td></tr>`;
      if (pi === 4) html += `<tr><td colspan="${2+streams.length}" style="background:var(--border-lt);color:var(--muted);font-size:.65rem;font-weight:700;text-align:center;padding:3px">LONG BREAK 11:10–11:30</td></tr>`;
      if (pi === 6) html += `<tr><td colspan="${2+streams.length}" style="background:var(--border-lt);color:var(--muted);font-size:.65rem;font-weight:700;text-align:center;padding:3px">LUNCH 12:50–14:00</td></tr>`;

      html += `<tr>`;
      if (pi === 0) html += `<td rowspan="${TT_LESSON_PERIODS.length}" style="font-weight:800;background:var(--primary);color:#fff;text-align:center">${day}</td>`;
      html += `<td style="font-size:.7rem;color:var(--muted);text-align:center">P${pi+1}<br>${p.time}</td>`;
      streams.forEach(s => {
        const grid = getTimetable(s.id, term, year);
        const cell = grid[day]?.[pid] || {};
        if (cell.isPPI || cell.subject==='PPI') { html += `<td><span class="tt-ppi">PPI</span></td>`; return; }
        if (!cell.subject) { html += `<td style="color:var(--border)">—</td>`; return; }
        const colCls = cell.teacher ? tchColorClass(cell.teacher) : ttSubjectColour(cell.subject);
        html += `<td><span class="tt-subj-chip ${colCls}">${cell.subject}</span>${cell.teacher?`<div class="tt-teacher">${cell.teacher}</div>`:''}</td>`;
      });
      html += `</tr>`;
    });
    if (di < TT_DAYS.length-1) html += `<tr><td colspan="${2+streams.length}" style="background:var(--primary);height:4px;padding:0"></td></tr>`;
  });

  html += `</tbody></table></div>${buildTeacherLegend()}
  <div style="padding:.5rem 1rem;font-size:.7rem;color:var(--muted);text-align:right;border-top:1px solid var(--border)">
    Charanas Analyzer · ${settings.schoolName||''} · Printed: ${new Date().toLocaleDateString()}
  </div></div>`;
  wrap.innerHTML = html;
}

function printBlockTimetable() {
  const wrap = document.getElementById('ttBlockPrintable');
  if (!wrap) { showToast('Generate a block timetable first','error'); return; }
  const pw = window.open('','_blank','width=1400,height=900');
  pw.document.write(buildPrintHTMLShell(wrap.outerHTML, _buildPrintStyles()));
  pw.document.close();
  setTimeout(()=>{ pw.focus(); pw.print(); pw.close(); }, 400);
}

// ═══════════════════════════════════════════════════════════
//  AUTO-GENERATE TIMETABLE
// ═══════════════════════════════════════════════════════════

// Default subject→teacher allocations from the PDF timetable
const TT_DEFAULT_ALLOCS = [
  // Subject code, teacher initials, periods per week per stream
  { subj:'ENG',      tch:'SW', ppw:2 },
  { subj:'KISW',     tch:'MP', ppw:2 },  // Kiswahili — also JN for some
  { subj:'MATH',     tch:'MG', ppw:2 },  // also MB, AM, EA
  { subj:'INT/SCI',  tch:'MB', ppw:2 },  // also MG
  { subj:'S.S',      tch:'EA', ppw:2 },  // also DW, JN
  { subj:'CRE',      tch:'EA', ppw:1 },  // also DW
  { subj:'AGR/NUT',  tch:'DW', ppw:1 },  // also MP, MG
  { subj:'PRE-TECH', tch:'AM', ppw:1 },
  { subj:'CASP',     tch:'P',  ppw:2 },
  { subj:'PPI',      tch:'',   ppw:1 },  // pastoral — no specific teacher
];

function loadAutoAllocUI() {
  populateTtAutoScope();
  const el = document.getElementById('ttAutoSubjectAllocs');
  if (!el) return;

  // Build allocation table: rows=streams, cols=subjects
  const subjCodes = TT_DEFAULT_ALLOCS.map(a=>a.subj);

  let html = `<p style="font-size:.82rem;color:var(--muted);margin-bottom:.5rem">
    Configure teacher initials and periods-per-week for each subject. These are pre-filled from the uploaded timetable.
  </p>
  <div style="overflow-x:auto"><table class="tt-alloc-table">
    <thead><tr><th>Stream</th>${subjCodes.map(s=>`<th>${s}</th>`).join('')}</tr>
    <tr><th style="font-size:.68rem;color:var(--muted)">Teacher / PPW</th>${subjCodes.map((_,i)=>`<th style="font-size:.68rem;color:var(--muted)">${TT_DEFAULT_ALLOCS[i].tch||'—'} / ${TT_DEFAULT_ALLOCS[i].ppw}</th>`).join('')}</tr>
    </thead><tbody>`;

  streams.forEach(s => {
    const cls = classes.find(c=>c.id===s.classId);
    const savedAlloc = ttAlloc[s.id] || {};
    html += `<tr><td style="font-weight:700">${cls?.name||''} ${s.name}</td>`;
    subjCodes.forEach((code, si) => {
      const def = TT_DEFAULT_ALLOCS[si];
      const saved = savedAlloc[code] || {};
      const tch = saved.tch !== undefined ? saved.tch : def.tch;
      const ppw = saved.ppw !== undefined ? saved.ppw : def.ppw;
      html += `<td>
        <input type="text" class="tt-alloc-tch" data-stream="${s.id}" data-subj="${code}" value="${tch}" placeholder="TCH" style="width:45px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-family:inherit;font-size:.78rem"/>
        <input type="number" class="tt-alloc-ppw" data-stream="${s.id}" data-subj="${code}" value="${ppw}" min="0" max="8" style="width:36px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-family:inherit;font-size:.78rem"/>
      </td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

function _saveAllocFromUI() {
  document.querySelectorAll('.tt-alloc-tch').forEach(inp => {
    const { stream, subj } = inp.dataset;
    if (!ttAlloc[stream]) ttAlloc[stream] = {};
    if (!ttAlloc[stream][subj]) ttAlloc[stream][subj] = {};
    ttAlloc[stream][subj].tch = inp.value.trim();
  });
  document.querySelectorAll('.tt-alloc-ppw').forEach(inp => {
    const { stream, subj } = inp.dataset;
    if (!ttAlloc[stream]) ttAlloc[stream] = {};
    if (!ttAlloc[stream][subj]) ttAlloc[stream][subj] = {};
    ttAlloc[stream][subj].ppw = parseInt(inp.value)||0;
  });
}

function autoGenerateTimetables() {
  _saveAllocFromUI();
  const term  = document.getElementById('ttAutoTerm').value;
  const year  = document.getElementById('ttAutoYear').value;
  const scope = document.getElementById('ttAutoScope').value;
  const status = document.getElementById('ttAutoStatus');

  const targetStreams = scope === 'all' ? streams : streams.filter(s=>s.id===scope);
  if (!targetStreams.length) { showToast('No streams found','error'); return; }

  status.innerHTML = `<div style="padding:.5rem;background:var(--primary-lt);border-radius:6px;font-size:.82rem">⏳ Generating timetables…</div>`;

  let errors = [];
  let generated = 0;

  targetStreams.forEach(stream => {
    const result = _generateStreamTimetable(stream, term, year);
    if (result.ok) { generated++; }
    else { errors.push(`${stream.name}: ${result.msg}`); }
  });

  saveTimetables();

  if (errors.length) {
    status.innerHTML = `<div class="tt-collision-badge">⚠️ Generated ${generated}/${targetStreams.length} streams. Issues:<br>${errors.join('<br>')}</div>`;
  } else {
    status.innerHTML = `<div class="tt-ok-badge">✅ Successfully generated timetables for all ${generated} stream(s) without collisions!</div>`;
  }
  showToast(`Generated ${generated} timetable(s) ✓`,'success');
}

function _generateStreamTimetable(stream, term, year) {
  const alloc = {};
  const subjCodes = TT_DEFAULT_ALLOCS.map(a=>a.subj);

  // Build allocation for this stream
  subjCodes.forEach(code => {
    const saved = ttAlloc[stream.id]?.[code];
    const def   = TT_DEFAULT_ALLOCS.find(a=>a.subj===code);
    alloc[code] = {
      tch: saved?.tch !== undefined ? saved.tch : (def?.tch||''),
      ppw: saved?.ppw !== undefined ? saved.ppw : (def?.ppw||0),
    };
  });

  // Build list of lesson slots to fill: [subject] repeated ppw times
  const lessons = [];
  subjCodes.forEach(code => {
    const { tch, ppw } = alloc[code];
    for (let i=0; i<ppw; i++) lessons.push({ subject:code, teacher:tch, isPPI:code==='PPI' });
  });

  const totalSlots = TT_DAYS.length * TT_LESSON_PERIODS.length;
  if (lessons.length > totalSlots) {
    return { ok:false, msg:`Too many periods (${lessons.length}) for available slots (${totalSlots})` };
  }

  // Shuffle lessons for variety
  _shuffleArray(lessons);

  // Build empty grid
  const grid = {};
  TT_DAYS.forEach(day => {
    grid[day] = {};
    TT_LESSON_PERIODS.forEach(pid => { grid[day][pid] = { subject:'', teacher:'', isPPI:false }; });
  });

  // Place lessons avoiding teacher collision across all streams (already-generated timetables)
  let placed = 0;
  let maxAttempts = lessons.length * 50;
  let attempts    = 0;
  const pendingLessons = [...lessons];

  while (pendingLessons.length > 0 && attempts < maxAttempts) {
    attempts++;
    const lesson = pendingLessons[0];

    // Find a free slot where this teacher isn't already teaching in another stream
    const slot = _findFreeSlot(grid, lesson.teacher, stream.id, term, year);
    if (slot) {
      grid[slot.day][slot.pid] = { ...lesson };
      pendingLessons.shift();
      placed++;
    } else {
      // Try rotating — move this lesson to end and try next
      pendingLessons.push(pendingLessons.shift());
    }
  }

  if (pendingLessons.length > 0) {
    // Place remaining ignoring collision (best effort)
    pendingLessons.forEach(lesson => {
      const slot = _findAnyFreeSlot(grid);
      if (slot) grid[slot.day][slot.pid] = { ...lesson };
    });
  }

  // Register teacher colours
  subjCodes.forEach(code => { if (alloc[code].tch) tchColorClass(alloc[code].tch); });

  timetables[ttKey(stream.id, term, year)] = grid;
  return { ok:true };
}

function _findFreeSlot(grid, teacher, streamId, term, year) {
  // Collect all day+period combos and shuffle for randomness
  const slots = [];
  TT_DAYS.forEach(day => TT_LESSON_PERIODS.forEach(pid => { if (!grid[day][pid].subject) slots.push({day,pid}); }));
  _shuffleArray(slots);
  for (const slot of slots) {
    if (!teacher || !_teacherBusyElsewhere(teacher, slot.day, slot.pid, streamId, term, year)) {
      return slot;
    }
  }
  return null;
}

function _findAnyFreeSlot(grid) {
  for (const day of TT_DAYS) {
    for (const pid of TT_LESSON_PERIODS) {
      if (!grid[day][pid].subject) return {day,pid};
    }
  }
  return null;
}

function _teacherBusyElsewhere(teacher, day, pid, myStreamId, term, year) {
  if (!teacher) return false;
  for (const s of streams) {
    if (s.id === myStreamId) continue;
    const key = ttKey(s.id, term, year);
    if (!timetables[key]) continue;
    const cell = timetables[key][day]?.[pid];
    if (cell?.teacher && (
      cell.teacher === teacher ||
      cell.teacher.toUpperCase() === teacher.toUpperCase()
    )) return true;
  }
  return false;
}

function _shuffleArray(arr) {
  for (let i=arr.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
}

// ═══════════════════════════════════════════════════════════
//  COLLISION CHECKER
// ═══════════════════════════════════════════════════════════
function runCollisionCheck() {
  const term  = document.getElementById('ttCheckTerm').value;
  const year  = document.getElementById('ttCheckYear').value;
  const el    = document.getElementById('ttCollisionResult');
  if (!el) return;

  const collisions = [];

  TT_DAYS.forEach(day => {
    TT_LESSON_PERIODS.forEach(pid => {
      // For each day+period, collect { teacher -> [streams] }
      const tchMap = {};
      streams.forEach(s => {
        const key  = ttKey(s.id, term, year);
        const cell = timetables[key]?.[day]?.[pid];
        if (cell?.teacher && cell.subject && cell.subject !== 'PPI') {
          if (!tchMap[cell.teacher]) tchMap[cell.teacher] = [];
          const cls = classes.find(c=>c.id===s.classId);
          tchMap[cell.teacher].push(`${cls?.name||''} ${s.name}`);
        }
      });
      // Report any teacher appearing in 2+ streams
      Object.entries(tchMap).forEach(([tch, strs]) => {
        if (strs.length > 1) {
          const p = TT_PERIODS.find(x=>x.id===pid);
          collisions.push({ day, time:p?.time||pid, teacher:tch, streams:strs });
        }
      });
    });
  });

  if (!collisions.length) {
    el.innerHTML = `<div class="tt-ok-badge">✅ No collisions found! All teacher assignments are valid for ${term} ${year}.</div>`;
  } else {
    el.innerHTML = collisions.map(c =>
      `<div class="tt-collision-badge">⚠️ <strong>${c.teacher}</strong> is assigned to <strong>${c.streams.join(' & ')}</strong> on <strong>${c.day} ${c.time}</strong></div>`
    ).join('') + `<div style="margin-top:.5rem;font-size:.78rem;color:var(--muted)">${collisions.length} collision(s) found. Use Auto-Generate or manually edit the affected cells.</div>`;
  }
}

// ── Patch go() to handle timetable section ───────────────

function go(sec, el) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sn').forEach(n => n.classList.remove('active'));
  const s = document.getElementById('s-'+sec);
  if (s) s.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('tbTitle').textContent = el ? el.querySelector('span').textContent : sec;
  // Scroll main content area back to top on every navigation
  const mainEl = document.querySelector('.main');
  if (mainEl) mainEl.scrollTop = 0;
  if (window.innerWidth < 960) closeSidebar(); // auto-close on mobile only
  if (sec === 'dashboard')  renderDashboard();
  if (sec === 'exams')      { populateExamDropdowns(); }
  if (sec === 'reports')    { populateReportDropdowns(); }
  if (sec === 'messaging')  { loadMsgRecipients(); }
  if (sec === 'fees')       { initFeesSection(); }
  if (sec === 'papers')     { initPapersSection(); }
  if (sec === 'settings')   { renderTeacherPreferences(); }
  if (sec === 'exambuilder') { /* handled by EB module DOMContentLoaded wrapper */ }
  if (sec === 'timetable')  {
    loadTimetables();
    populateTtStreamDropdown();
    populateTtTeacherDropdown();
    populateTtAutoScope();
    renderTimetable();
  }
}

// ═══════════════════════════════════════════════
//  LANGUAGE / TRANSLATION SYSTEM
// ═══════════════════════════════════════════════

const TRANSLATIONS = {
  en: {
    // Sidebar nav
    nav_dashboard:  'Dashboard',
    nav_exams:      'Exams',
    nav_students:   'Students',
    nav_teachers:   'Teachers',
    nav_subjects:   'Subjects',
    nav_classes:    'Classes & Streams',
    nav_timetable:  'Timetables',
    nav_reports:    'Report Forms',
    nav_messaging:  'Messaging',
    nav_settings:   'Settings',
    nav_darkmode:   'Dark Mode',
    nav_logout:     'Logout',
    // Dashboard
    ph_dashboard:   "Good morning! 👋",
    ph_dashboard_sub: "Here's your school's academic overview.",
    // Exams
    ph_exams:       '📝 Exams',
    ph_exams_sub:   'Create, manage, upload marks, and analyse examinations.',
    tab_create:     'Create Exam',
    tab_examlist:   'Exam List',
    tab_upload:     'Upload Marks',
    tab_analyse:    'Analyse',
    tab_merit:      'Merit List',
    tab_subanalysis:'Subject Analysis',
    // Students
    ph_students:    '🎓 Students',
    ph_students_sub:'Manage student records and enrolments.',
    // Teachers
    ph_teachers:    '👨‍🏫 Teachers',
    ph_teachers_sub:'Manage teachers, subjects, and system access.',
    // Subjects
    ph_subjects:    '📚 Subjects',
    ph_subjects_sub:'Manage subjects, assign teachers and enrol students.',
    // Classes
    ph_classes:     '🏫 Classes & Streams',
    ph_classes_sub: 'Manage class and stream assignments.',
    // Timetable
    ph_timetable:   '🕐 Timetables',
    ph_timetable_sub:'Generate, view and print class, teacher and block timetables.',
    // Reports
    ph_reports:     '📄 Report Forms',
    ph_reports_sub: 'Generate downloadable PDF report forms for students.',
    // Messaging
    ph_messaging:   '💬 Messaging (SMS)',
    ph_messaging_sub:'Send messages to parents and teachers.',
    // Settings
    ph_settings:    '⚙ Settings',
    ph_settings_sub:'Configure your school system.',
    // Buttons
    btn_save:       '💾 Save',
    btn_cancel:     '✕ Cancel',
    btn_generate:   '📄 Generate',
    btn_preview:    '👁 Preview',
    btn_print:      '🖨 Print',
    btn_excel:      '⬇ Excel',
    btn_pdf:        '⬇ PDF',
    btn_run:        '▶ Run',
  },
  sw: {
    // Sidebar nav
    nav_dashboard:  'Dashibodi',
    nav_exams:      'Mitihani',
    nav_students:   'Wanafunzi',
    nav_teachers:   'Walimu',
    nav_subjects:   'Masomo',
    nav_classes:    'Madarasa & Vikundi',
    nav_timetable:  'Ratiba za Masomo',
    nav_reports:    'Fomu za Ripoti',
    nav_messaging:  'Ujumbe',
    nav_settings:   'Mipangilio',
    nav_darkmode:   'Hali ya Giza',
    nav_logout:     'Toka',
    // Dashboard
    ph_dashboard:   "Habari za asubuhi! 👋",
    ph_dashboard_sub: "Hapa kuna muhtasari wa kitaaluma wa shule yako.",
    // Exams
    ph_exams:       '📝 Mitihani',
    ph_exams_sub:   'Unda, simamia, pakia alama na uchanganue mitihani.',
    tab_create:     'Unda Mtihani',
    tab_examlist:   'Orodha ya Mitihani',
    tab_upload:     'Pakia Alama',
    tab_analyse:    'Uchanganuzi',
    tab_merit:      'Orodha ya Sifa',
    tab_subanalysis:'Uchanganuzi wa Somo',
    // Students
    ph_students:    '🎓 Wanafunzi',
    ph_students_sub:'Simamia rekodi na usajili wa wanafunzi.',
    // Teachers
    ph_teachers:    '👨‍🏫 Walimu',
    ph_teachers_sub:'Simamia walimu, masomo, na ufikiaji wa mfumo.',
    // Subjects
    ph_subjects:    '📚 Masomo',
    ph_subjects_sub:'Simamia masomo, weka walimu na usajili wanafunzi.',
    // Classes
    ph_classes:     '🏫 Madarasa & Vikundi',
    ph_classes_sub: 'Simamia mgawanyo wa madarasa na vikundi.',
    // Timetable
    ph_timetable:   '🕐 Ratiba za Masomo',
    ph_timetable_sub:'Tengeneza, angalia na chapisha ratiba za masomo.',
    // Reports
    ph_reports:     '📄 Fomu za Ripoti',
    ph_reports_sub: 'Tengeneza fomu za ripoti za PDF zinazoweza kupakuliwa.',
    // Messaging
    ph_messaging:   '💬 Ujumbe (SMS)',
    ph_messaging_sub:'Tuma ujumbe kwa wazazi na walimu.',
    // Settings
    ph_settings:    '⚙ Mipangilio',
    ph_settings_sub:'Sanidi mfumo wa shule yako.',
    // Buttons
    btn_save:       '💾 Hifadhi',
    btn_cancel:     '✕ Ghairi',
    btn_generate:   '📄 Tengeneza',
    btn_preview:    '👁 Hakiki',
    btn_print:      '🖨 Chapisha',
    btn_excel:      '⬇ Excel',
    btn_pdf:        '⬇ PDF',
    btn_run:        '▶ Endesha',
  }
};

// Map of data-i18n keys to DOM selectors
const I18N_MAP = [
  // Sidebar nav spans
  { key:'nav_dashboard',  sel:'[data-s=dashboard] span' },
  { key:'nav_exams',      sel:'[data-s=exams] span' },
  { key:'nav_students',   sel:'[data-s=students] span' },
  { key:'nav_teachers',   sel:'[data-s=teachers] span' },
  { key:'nav_subjects',   sel:'[data-s=subjects] span' },
  { key:'nav_classes',    sel:'[data-s=classes] span' },
  { key:'nav_timetable',  sel:'[data-s=timetable] span' },
  { key:'nav_reports',    sel:'[data-s=reports] span' },
  { key:'nav_messaging',  sel:'[data-s=messaging] span' },
  { key:'nav_settings',   sel:'[data-s=settings] span' },
  { key:'nav_darkmode',   sel:'#dmLbl' },
  // Page headers
  { key:'ph_dashboard',     sel:'#s-dashboard .ph h2' },
  { key:'ph_dashboard_sub', sel:'#s-dashboard .ph p' },
  { key:'ph_exams',         sel:'#s-exams .ph h2' },
  { key:'ph_exams_sub',     sel:'#s-exams .ph p' },
  { key:'ph_students',      sel:'#s-students .ph h2' },
  { key:'ph_students_sub',  sel:'#s-students .ph p' },
  { key:'ph_teachers',      sel:'#s-teachers .ph h2' },
  { key:'ph_teachers_sub',  sel:'#s-teachers .ph p' },
  { key:'ph_subjects',      sel:'#s-subjects .ph h2' },
  { key:'ph_subjects_sub',  sel:'#s-subjects .ph p' },
  { key:'ph_classes',       sel:'#s-classes .ph h2' },
  { key:'ph_classes_sub',   sel:'#s-classes .ph p' },
  { key:'ph_timetable',     sel:'#s-timetable .ph h2' },
  { key:'ph_timetable_sub', sel:'#s-timetable .ph p' },
  { key:'ph_reports',       sel:'#s-reports .ph h2' },
  { key:'ph_reports_sub',   sel:'#s-reports .ph p' },
  { key:'ph_messaging',     sel:'#s-messaging .ph h2' },
  { key:'ph_messaging_sub', sel:'#s-messaging .ph p' },
  { key:'ph_settings',      sel:'#s-settings .ph h2' },
  { key:'ph_settings_sub',  sel:'#s-settings .ph p' },
  // Exam tabs
  { key:'tab_create',      sel:'#examTabBar .tb:nth-child(1)' },
  { key:'tab_examlist',    sel:'#examTabBar .tb:nth-child(2)' },
  { key:'tab_upload',      sel:'#examTabBar .tb:nth-child(3)' },
  { key:'tab_analyse',     sel:'#tbAnalyse' },
  { key:'tab_merit',       sel:'#examTabBar .tb:nth-child(5)' },
  { key:'tab_subanalysis', sel:'#tbSubjectAnalysis' },
];

let currentLang = localStorage.getItem('ei_lang') || 'en';

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('ei_lang', lang);
  // Toggle active button
  document.getElementById('langEN').classList.toggle('active', lang === 'en');
  document.getElementById('langSW').classList.toggle('active', lang === 'sw');
  applyTranslations();
}

function applyTranslations() {
  const T = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  I18N_MAP.forEach(({ key, sel }) => {
    const el = document.querySelector(sel);
    if (el && T[key] !== undefined) el.textContent = T[key];
  });
  // Also update topbar title to current section
  const activeNav = document.querySelector('.sn.active span');
  if (activeNav) document.getElementById('tbTitle').textContent = activeNav.textContent;
}

// Init language on load (called from initApp)
function initLang() {
  currentLang = localStorage.getItem('ei_lang') || 'en';
  document.getElementById('langEN').classList.toggle('active', currentLang === 'en');
  document.getElementById('langSW').classList.toggle('active', currentLang === 'sw');
  applyTranslations();
}

// ══════════════════════════════════════════════════════════
//  FEES MANAGEMENT MODULE — Charanas Analyzer
// ══════════════════════════════════════════════════════════

const K_FEES_STRUCT = 'ei_fee_structures';
const K_FEES_RECORDS = 'ei_fee_records';

let feeStructures = [];   // [{id,classId,term,year,totalFee,breakdown:[{item,amount}]}]
let feeRecords = [];      // [{id,studentId,classId,term,year,totalFee,payments:[{id,receiptNo,date,amount,mode,notes,balanceBefore,balanceAfter}]}]
let lastReceiptHtml = '';

function loadFees() {
  try { feeStructures = JSON.parse(localStorage.getItem(K_FEES_STRUCT)) || []; } catch { feeStructures = []; }
  try { feeRecords    = JSON.parse(localStorage.getItem(K_FEES_RECORDS)) || []; } catch { feeRecords = []; }
}
function saveFees() {
  localStorage.setItem(K_FEES_STRUCT,  JSON.stringify(feeStructures));
  localStorage.setItem(K_FEES_RECORDS, JSON.stringify(feeRecords));
}

// ── Generate a unique receipt number ──
function genReceiptNo() {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth()+1).padStart(2,'0');
  const dd  = String(now.getDate()).padStart(2,'0');
  const rnd = Math.floor(Math.random()*9000)+1000;
  return `RCP${yy}${mm}${dd}-${rnd}`;
}

// ── Get or create a student fee record ──
function getOrCreateFeeRecord(studentId, classId, term, year) {
  let rec = feeRecords.find(r => r.studentId===studentId && r.term===term && String(r.year)===String(year));
  if (!rec) {
    const struct = getFeeStructure(classId, term, year);
    rec = { id: uid(), studentId, classId, term, year: String(year), totalFee: struct ? struct.totalFee : 0, payments: [] };
    feeRecords.push(rec);
    saveFees();
  }
  return rec;
}

function getFeeStructure(classId, term, year) {
  return feeStructures.find(f => f.classId===classId && f.term===term && String(f.year)===String(year));
}

function getRecordTotalPaid(rec) {
  return rec.payments.reduce((a, p) => a + parseFloat(p.amount||0), 0);
}
function getRecordBalance(rec) {
  return parseFloat(rec.totalFee||0) - getRecordTotalPaid(rec);
}

// ── Get fee data for a student (for a given term/year) ──
function getStudentFeeData(studentId, term, year) {
  const stu = students.find(s => s.id === studentId);
  if (!stu) return null;
  const rec = feeRecords.find(r => r.studentId===studentId && r.term===term && String(r.year)===String(year));
  if (!rec) return null;
  const paid = getRecordTotalPaid(rec);
  const bal  = getRecordBalance(rec);
  return { rec, paid, bal, totalFee: rec.totalFee, cleared: bal <= 0 };
}

// ── Open Fees Tab ──
function openFeesTab(tabId, btn) {
  document.querySelectorAll('#s-fees .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#feesTabBar .tb').forEach(b => b.classList.remove('active'));
  const p = document.getElementById(tabId); if (p) p.classList.add('active');
  if (btn) btn.classList.add('active');
  if (tabId === 'tabFeeOverview')   renderFeeOverview();
  if (tabId === 'tabFeeStructure')  renderFeeStructureList();
  if (tabId === 'tabFeePayments')   initFeePaymentForm();
  if (tabId === 'tabFeeStudents')   renderStudentBalances();
  if (tabId === 'tabFeeReminders')  renderFeeReminders();
  if (tabId === 'tabFeeReceipts')   renderReceiptsLog();
}

// ── Populate Fees Filter Dropdowns ──
function populateFeesDropdowns() {
  const isTeacher = currentUser && currentUser.role === 'teacher';
  const teacherStreamIds = isTeacher ? getClassTeacherStreamIds(currentUser.teacherId) : [];
  const teacherClassIds  = isTeacher ? [...new Set(teacherStreamIds.map(sid => { const s=streams.find(x=>x.id===sid); return s?s.classId:null; }).filter(Boolean))] : null;

  // Determine visible classes
  const visibleClasses = teacherClassIds
    ? classes.filter(c => teacherClassIds.includes(c.id))
    : classes;

  // Collect all years from structures + records
  const years = [...new Set([
    ...feeStructures.map(f => f.year),
    ...feeRecords.map(r => r.year),
    String(new Date().getFullYear())
  ])].sort((a,b)=>b-a);

  const classOptions = '<option value="">All Classes</option>' + visibleClasses.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const yearOptions  = '<option value="">All Years</option>'  + years.map(y=>`<option value="${y}">${y}</option>`).join('');

  ['fovClass','fsbClass','fremClass','frctClass'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = classOptions;
  });
  ['fovYear','fsbYear','fremYear'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = yearOptions;
  });

  // Fee structure & payment form class dropdowns
  const strictClassOptions = '<option value="">— Select Class —</option>' + visibleClasses.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  ['fstrClass','fpClass'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = strictClassOptions;
  });

  // Year dropdowns for payment form
  const yearSelectOptions = years.map(y=>`<option value="${y}">${y}</option>`).join('');
  const fpYear = document.getElementById('fpYear'); if (fpYear) fpYear.innerHTML = yearSelectOptions;

  // Default current term in filters
  const curTerm = settings.currentTerm || 'Term 1';
  ['fovTerm','fsbTerm','fremTerm','fpTerm','frctTerm'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value === '') {
      for (const opt of el.options) { if (opt.value === curTerm) { opt.selected = true; break; } }
    }
  });
  const curYear = String(settings.currentYear || new Date().getFullYear());
  ['fovYear','fsbYear','fremYear','fpYear'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { for (const opt of el.options) { if (opt.value === curYear) { opt.selected = true; break; } } }
  });
}

// ── Init Fees Section ──
function initFeesSection() {
  loadFees();
  populateFeesDropdowns();

  const role      = currentUser && currentUser.role;
  const isFullFees = role === 'superadmin' || role === 'admin' || role === 'principal' || role === 'bursar';
  const isTeacher  = role === 'teacher';
  const isClassTch = isTeacher && currentUserIsClassTeacher();

  // Full-fees users: all tabs visible
  // Class teacher: Overview + Student Balances only (read their classes)
  // Regular teacher: should never reach here (no fees link), but guard anyway
  const tabs = {
    tbFeeStructure : isFullFees,
    tbFeePayments  : isFullFees,
    tbFeeReminders : isFullFees,
    tbFeeReceipts  : isFullFees,
    tbFeeStudents  : isFullFees || isClassTch,
    tbFeeOverview  : true, // always
  };
  Object.entries(tabs).forEach(([id, show]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  });

  // Admin stats bar: full-fees roles only
  const statsBar = document.getElementById('feesAdminStats');
  if (statsBar) statsBar.style.display = isFullFees ? '' : 'none';

  // If current active tab is now hidden, fall back to Overview
  const activeTab = document.querySelector('#feesTabBar .tb.active');
  if (activeTab && activeTab.style.display === 'none') {
    openFeesTab('tabFeeOverview', document.getElementById('tbFeeOverview'));
  }

  renderFeeOverview();
}

// ═══════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════
function renderFeeOverview() {
  loadFees();
  const filterClass = document.getElementById('fovClass')?.value || '';
  const filterTerm  = document.getElementById('fovTerm')?.value  || '';
  const filterYear  = document.getElementById('fovYear')?.value  || '';

  const isTeacher = currentUser && currentUser.role === 'teacher';
  const isFullFeesRole = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin'||currentUser.role==='principal'||currentUser.role==='bursar');
  const teacherClassIds = (isTeacher && !isFullFeesRole)
    ? [...new Set(getClassTeacherStreamIds(currentUser.teacherId).map(sid => { const s=streams.find(x=>x.id===sid); return s?s.classId:null; }).filter(Boolean))]
    : null;

  let visibleClasses = teacherClassIds ? classes.filter(c => teacherClassIds.includes(c.id)) : classes;
  if (filterClass) visibleClasses = visibleClasses.filter(c => c.id === filterClass);

  // Build summary per class
  let totalExpected=0, totalCollected=0, totalOutstanding=0, totalStudents=0;
  const rows = visibleClasses.map(cls => {
    const classStudents = students.filter(s => s.classId === cls.id);
    let expected=0, collected=0;

    classStudents.forEach(stu => {
      const recs = feeRecords.filter(r => r.studentId===stu.id
        && (!filterTerm || r.term===filterTerm)
        && (!filterYear || String(r.year)===filterYear));
      recs.forEach(r => {
        expected   += parseFloat(r.totalFee||0);
        collected  += getRecordTotalPaid(r);
      });
      // If no record but structure exists, count as expected
      if (!recs.length) {
        const structs = feeStructures.filter(f => f.classId===cls.id
          && (!filterTerm || f.term===filterTerm)
          && (!filterYear || String(f.year)===filterYear));
        structs.forEach(s => { expected += parseFloat(s.totalFee||0); });
      }
    });

    const outstanding = expected - collected;
    const pct = expected > 0 ? Math.round(collected/expected*100) : 0;
    totalExpected    += expected;
    totalCollected   += collected;
    totalOutstanding += outstanding;
    totalStudents    += classStudents.length;

    return { cls, students: classStudents.length, expected, collected, outstanding, pct };
  });

  // Stats cards
  const statsEl = document.getElementById('feeOverviewStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="fee-ov-stat-row">
        <div class="fee-stat-card fsc-blue"><div class="fsc-ico">👥</div><div class="fsc-val">${totalStudents}</div><div class="fsc-lbl">Total Students</div></div>
        <div class="fee-stat-card fsc-teal"><div class="fsc-ico">💰</div><div class="fsc-val">KES ${totalExpected.toLocaleString()}</div><div class="fsc-lbl">Total Expected</div></div>
        <div class="fee-stat-card fsc-green"><div class="fsc-ico">✅</div><div class="fsc-val">KES ${totalCollected.toLocaleString()}</div><div class="fsc-lbl">Total Collected</div></div>
        <div class="fee-stat-card fsc-red"><div class="fsc-ico">⚠️</div><div class="fsc-val">KES ${totalOutstanding.toLocaleString()}</div><div class="fsc-lbl">Outstanding</div></div>
        <div class="fee-stat-card fsc-amber"><div class="fsc-ico">📊</div><div class="fsc-val">${totalExpected>0?Math.round(totalCollected/totalExpected*100):0}%</div><div class="fsc-lbl">Collection Rate</div></div>
      </div>`;
  }

  // Admin global stats bar
  const adminBar = document.getElementById('feesAdminStats');
  if (adminBar && (currentUser.role==='superadmin'||currentUser.role==='admin')) {
    adminBar.innerHTML = `
      <div class="stat-card sc-blue"><div class="sc-num">KES ${totalExpected.toLocaleString()}</div><div class="sc-lbl">Expected</div><div class="sc-ico">💰</div></div>
      <div class="stat-card sc-green"><div class="sc-num">KES ${totalCollected.toLocaleString()}</div><div class="sc-lbl">Collected</div><div class="sc-ico">✅</div></div>
      <div class="stat-card sc-amber"><div class="sc-num">KES ${totalOutstanding.toLocaleString()}</div><div class="sc-lbl">Outstanding</div><div class="sc-ico">⚠️</div></div>
      <div class="stat-card sc-teal"><div class="sc-num">${totalExpected>0?Math.round(totalCollected/totalExpected*100):0}%</div><div class="sc-lbl">Collection Rate</div><div class="sc-ico">📊</div></div>`;
  }

  // Table
  const tbody = document.getElementById('feeOverviewBody');
  if (tbody) {
    tbody.innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><strong>${r.cls.name}</strong></td>
        <td>${r.students}</td>
        <td>KES ${r.expected.toLocaleString()}</td>
        <td>KES ${r.collected.toLocaleString()}</td>
        <td style="color:${r.outstanding>0?'var(--danger)':'var(--success)'}"><strong>KES ${r.outstanding.toLocaleString()}</strong></td>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem">
            <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${r.pct}%;background:${r.pct>=80?'var(--success)':r.pct>=50?'#f59e0b':'var(--danger)'};border-radius:4px"></div>
            </div>
            <span style="font-size:.8rem;font-weight:600;min-width:2.5rem">${r.pct}%</span>
          </div>
        </td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="filterToClass('${r.cls.id}')">View Students</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:2rem">No fee data found. Set up fee structures first.</td></tr>';
  }
}

function filterToClass(classId) {
  openFeesTab('tabFeeStudents', document.getElementById('tbFeeStudents'));
  setTimeout(() => {
    const el = document.getElementById('fsbClass');
    if (el) { el.value = classId; renderStudentBalances(); }
  }, 100);
}

// ═══════════════════════════════════════════
// FEE STRUCTURE
// ═══════════════════════════════════════════
function addFstrBreakdownRow() {
  const container = document.getElementById('fstrBreakdownRows');
  const div = document.createElement('div');
  div.className = 'frow c2 fstr-row';
  div.style.cssText = 'margin-bottom:.5rem;gap:.5rem';
  div.innerHTML = `
    <div class="fg"><input type="text" placeholder="Item (e.g. Tuition)" style="padding:.4rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);width:100%;font-size:.85rem" class="fstr-item"/></div>
    <div class="fg" style="display:flex;gap:.5rem">
      <input type="number" placeholder="Amount (KES)" min="0" style="padding:.4rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);width:100%;font-size:.85rem" class="fstr-amt"/>
      <button class="btn btn-sm btn-danger-sm" onclick="this.closest('.fstr-row').remove()">✕</button>
    </div>`;
  container.appendChild(div);
}

function clearFstrForm() {
  document.getElementById('fstrEditId').value = '';
  document.getElementById('fstrClass').value = '';
  document.getElementById('fstrTotal').value = '';
  document.getElementById('fstrBreakdownRows').innerHTML = '';
}

function saveFeeStructure() {
  const r = currentUser && currentUser.role;
  if (!(r==='superadmin'||r==='admin'||r==='principal'||r==='bursar')) { showToast('Only administrators can edit fee structures','error'); return; }
  loadFees();
  const editId  = document.getElementById('fstrEditId').value;
  const classId = document.getElementById('fstrClass').value;
  const term    = document.getElementById('fstrTerm').value;
  const year    = document.getElementById('fstrYear').value;
  const total   = parseFloat(document.getElementById('fstrTotal').value);

  if (!classId || !term || !year || isNaN(total) || total <= 0) {
    showToast('Please fill Class, Term, Year and a valid Total Fee', 'error'); return;
  }

  // Collect breakdown rows
  const breakdown = [];
  document.querySelectorAll('.fstr-row').forEach(row => {
    const item = row.querySelector('.fstr-item')?.value.trim();
    const amt  = parseFloat(row.querySelector('.fstr-amt')?.value||0);
    if (item && amt > 0) breakdown.push({ item, amount: amt });
  });

  if (editId) {
    const i = feeStructures.findIndex(f => f.id === editId);
    if (i > -1) feeStructures[i] = { ...feeStructures[i], classId, term, year, totalFee: total, breakdown };
  } else {
    // Check for duplicate
    const dup = feeStructures.find(f => f.classId===classId && f.term===term && String(f.year)===String(year));
    if (dup) { showToast('A structure already exists for this class/term/year. Edit it instead.', 'error'); return; }
    feeStructures.push({ id: uid(), classId, term, year: String(year), totalFee: total, breakdown });
  }

  saveFees();
  clearFstrForm();
  renderFeeStructureList();
  populateFeesDropdowns();
  showToast('Fee structure saved ✓', 'success');
}

function renderFeeStructureList() {
  loadFees();
  const el = document.getElementById('feeStructureList');
  if (!el) return;
  if (!feeStructures.length) { el.innerHTML = '<p style="color:var(--muted)">No fee structures yet.</p>'; return; }

  el.innerHTML = feeStructures.map(f => {
    const cls = classes.find(c => c.id === f.classId);
    return `
      <div class="fee-struct-item">
        <div class="fsi-head">
          <div>
            <strong>${cls?.name || 'Unknown Class'}</strong>
            <span class="badge b-blue" style="font-size:.65rem;margin-left:.4rem">${f.term} ${f.year}</span>
          </div>
          <strong style="color:var(--primary)">KES ${parseFloat(f.totalFee).toLocaleString()}</strong>
        </div>
        ${f.breakdown && f.breakdown.length ? `
          <div class="fsi-breakdown">
            ${f.breakdown.map(b=>`<span>${b.item}: <strong>KES ${parseFloat(b.amount).toLocaleString()}</strong></span>`).join('')}
          </div>` : ''}
        <div class="fsi-actions">
          <button class="btn btn-sm btn-outline" onclick="editFeeStructure('${f.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-danger-sm" onclick="deleteFeeStructure('${f.id}')">🗑 Delete</button>
        </div>
      </div>`;
  }).join('');
}

function editFeeStructure(id) {
  loadFees();
  const f = feeStructures.find(x => x.id === id); if (!f) return;
  document.getElementById('fstrEditId').value = id;
  document.getElementById('fstrClass').value  = f.classId;
  document.getElementById('fstrTerm').value   = f.term;
  document.getElementById('fstrYear').value   = f.year;
  document.getElementById('fstrTotal').value  = f.totalFee;
  const container = document.getElementById('fstrBreakdownRows');
  container.innerHTML = '';
  (f.breakdown||[]).forEach(b => {
    addFstrBreakdownRow();
    const rows = container.querySelectorAll('.fstr-row');
    const last = rows[rows.length-1];
    last.querySelector('.fstr-item').value = b.item;
    last.querySelector('.fstr-amt').value  = b.amount;
  });
  document.querySelector('#tabFeeStructure').scrollIntoView({ behavior: 'smooth' });
}

function deleteFeeStructure(id) {
  if (!confirm('Delete this fee structure?')) return;
  loadFees();
  feeStructures = feeStructures.filter(f => f.id !== id);
  saveFees();
  renderFeeStructureList();
  showToast('Fee structure deleted', 'info');
}

// ═══════════════════════════════════════════
// PAYMENT RECORDING
// ═══════════════════════════════════════════
function initFeePaymentForm() {
  const today = new Date().toISOString().split('T')[0];
  const fpDate = document.getElementById('fpDate');
  if (fpDate && !fpDate.value) fpDate.value = today;
  populateFeesDropdowns();
  onFpClassChange();
}

function onFpClassChange() {
  loadFees();
  const classId = document.getElementById('fpClass')?.value;
  const fpStudent = document.getElementById('fpStudent');
  if (!fpStudent) return;

  if (!classId) {
    fpStudent.innerHTML = '<option value="">— Select Student —</option>';
    document.getElementById('fpBalanceCard').style.display = 'none';
    return;
  }

  const classStudents = students.filter(s => s.classId === classId).sort((a,b) => a.name.localeCompare(b.name));
  fpStudent.innerHTML = '<option value="">— Select Student —</option>' + classStudents.map(s => `<option value="${s.id}">${s.name} (${s.adm})</option>`).join('');
  onFpStudentChange();
}

function onFpTermChange() {
  onFpStudentChange();
}

function onFpStudentChange() {
  loadFees();
  const stuId   = document.getElementById('fpStudent')?.value;
  const classId = document.getElementById('fpClass')?.value;
  const term    = document.getElementById('fpTerm')?.value;
  const year    = document.getElementById('fpYear')?.value;
  const card    = document.getElementById('fpBalanceCard');

  if (!stuId || !classId || !term || !year) {
    if (card) card.style.display = 'none'; return;
  }

  const struct = getFeeStructure(classId, term, year);
  const rec    = feeRecords.find(r => r.studentId===stuId && r.term===term && String(r.year)===String(year));
  const totalFee = rec ? parseFloat(rec.totalFee||0) : (struct ? parseFloat(struct.totalFee||0) : 0);
  const paid     = rec ? getRecordTotalPaid(rec) : 0;
  const bal      = totalFee - paid;

  document.getElementById('fpTotalFee').textContent  = `KES ${totalFee.toLocaleString()}`;
  document.getElementById('fpAmountPaid').textContent = `KES ${paid.toLocaleString()}`;
  document.getElementById('fpBalance').textContent    = `KES ${bal.toLocaleString()}`;
  document.getElementById('fpBalance').style.color    = bal > 0 ? 'var(--danger)' : 'var(--success)';
  if (card) card.style.display = 'block';
}

function recordFeePayment() {
  const r = currentUser && currentUser.role;
  if (!(r==='superadmin'||r==='admin'||r==='principal'||r==='bursar')) { showToast('Only administrators and the bursar can record payments','error'); return; }
  loadFees();
  const stuId   = document.getElementById('fpStudent')?.value;
  const classId = document.getElementById('fpClass')?.value;
  const term    = document.getElementById('fpTerm')?.value;
  const year    = document.getElementById('fpYear')?.value;
  const amount  = parseFloat(document.getElementById('fpAmount')?.value||0);
  const mode    = document.getElementById('fpMode')?.value || 'Cash';
  const date    = document.getElementById('fpDate')?.value || new Date().toISOString().split('T')[0];
  const notes   = document.getElementById('fpNotes')?.value || '';

  if (!stuId)   { showToast('Please select a student', 'error'); return; }
  if (!classId) { showToast('Please select a class', 'error'); return; }
  if (amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }

  const struct   = getFeeStructure(classId, term, year);
  const totalFee = struct ? parseFloat(struct.totalFee||0) : 0;

  if (!totalFee) {
    showToast('No fee structure set for this class/term/year. Create one first.', 'error'); return;
  }

  // Get or create record
  let rec = feeRecords.find(r => r.studentId===stuId && r.term===term && String(r.year)===String(year));
  if (!rec) {
    rec = { id: uid(), studentId: stuId, classId, term, year: String(year), totalFee, payments: [] };
    feeRecords.push(rec);
  }
  // Update totalFee from structure in case it changed
  rec.totalFee = totalFee;

  const balBefore = getRecordBalance(rec);
  const receiptNo = genReceiptNo();
  const payment = { id: uid(), receiptNo, date, amount, mode, notes, balanceBefore: balBefore, balanceAfter: balBefore - amount };
  rec.payments.push(payment);
  saveFees();

  // Build and show receipt
  const stu = students.find(s => s.id === stuId);
  const cls = classes.find(c => c.id === classId);
  lastReceiptHtml = buildReceiptHTML({ stu, cls, term, year, totalFee, payment, balBefore, balAfter: balBefore - amount, receiptNo, date, mode, notes, amount, schoolName: settings.schoolName || 'School' });

  const previewEl = document.getElementById('receiptPreview');
  if (previewEl) previewEl.innerHTML = lastReceiptHtml;
  const actEl = document.getElementById('receiptActions');
  if (actEl) actEl.style.display = 'flex';

  // Reset amount
  const amtEl = document.getElementById('fpAmount'); if (amtEl) amtEl.value = '';
  const notesEl = document.getElementById('fpNotes'); if (notesEl) notesEl.value = '';
  onFpStudentChange();
  showToast(`Payment of KES ${amount.toLocaleString()} recorded ✓ — Receipt ${receiptNo}`, 'success');

  // Auto-print receipt
  setTimeout(() => printLastReceipt(), 400);
}

function buildReceiptHTML({ stu, cls, term, year, totalFee, payment, balBefore, balAfter, receiptNo, date, mode, notes, amount, schoolName }) {
  const d = new Date(date);
  const dateStr = d.toLocaleDateString('en-KE', { day:'2-digit', month:'long', year:'numeric' });
  const status = balAfter <= 0 ? '<span style="color:#16a34a;font-weight:700">✅ FEES CLEARED</span>' : `<span style="color:#dc2626;font-weight:700">⚠️ BALANCE: KES ${balAfter.toLocaleString()}</span>`;
  return `
    <div class="fee-receipt" id="feeReceiptPrint">
      <div class="rcpt-header">
        <div class="rcpt-logo">CA</div>
        <div class="rcpt-school">
          <strong>${schoolName}</strong>
          <div style="font-size:.75rem;color:#64748b">${settings.address || ''} ${settings.phone ? '| Tel: '+settings.phone : ''}</div>
          <div style="font-weight:700;color:#1a6fb5;font-size:.85rem;margin-top:.15rem">OFFICIAL FEE RECEIPT</div>
        </div>
        <div class="rcpt-no">
          <div style="font-size:.65rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Receipt No.</div>
          <div style="font-size:1rem;font-weight:800;color:#1a6fb5">${receiptNo}</div>
          <div style="font-size:.72rem;color:#64748b">${dateStr}</div>
        </div>
      </div>
      <div class="rcpt-divider"></div>
      <div class="rcpt-body">
        <div class="rcpt-row"><span class="rcpt-lbl">Student Name</span><span class="rcpt-val">${stu?.name || '—'}</span></div>
        <div class="rcpt-row"><span class="rcpt-lbl">Admission No.</span><span class="rcpt-val">${stu?.adm || '—'}</span></div>
        <div class="rcpt-row"><span class="rcpt-lbl">Class</span><span class="rcpt-val">${cls?.name || '—'}</span></div>
        <div class="rcpt-row"><span class="rcpt-lbl">Term / Year</span><span class="rcpt-val">${term} — ${year}</span></div>
        <div class="rcpt-row"><span class="rcpt-lbl">Total Fee</span><span class="rcpt-val">KES ${parseFloat(totalFee).toLocaleString()}</span></div>
        <div class="rcpt-row"><span class="rcpt-lbl">Previous Balance</span><span class="rcpt-val" style="color:#dc2626">KES ${parseFloat(balBefore).toLocaleString()}</span></div>
        <div class="rcpt-divider-sm"></div>
        <div class="rcpt-row rcpt-paid-row">
          <span class="rcpt-lbl">Amount Paid</span>
          <span class="rcpt-val" style="color:#16a34a;font-size:1.1rem;font-weight:800">KES ${parseFloat(amount).toLocaleString()}</span>
        </div>
        <div class="rcpt-row"><span class="rcpt-lbl">Payment Mode</span><span class="rcpt-val">${mode}</span></div>
        ${notes ? `<div class="rcpt-row"><span class="rcpt-lbl">Reference</span><span class="rcpt-val">${notes}</span></div>` : ''}
        <div class="rcpt-divider-sm"></div>
        <div class="rcpt-row rcpt-bal-row">
          <span class="rcpt-lbl">Updated Balance</span>
          <span class="rcpt-val">${status}</span>
        </div>
      </div>
      <div class="rcpt-footer">
        <div class="rcpt-sig">Received by: ……………………………………</div>
        <div class="rcpt-sig">Cashier Stamp: ……………………………………</div>
      </div>
      <div style="text-align:center;font-size:.65rem;color:#94a3b8;margin-top:.5rem">This is a computer-generated receipt. No signature required. — ${schoolName}</div>
    </div>`;
}

function printLastReceipt() {
  if (!lastReceiptHtml) { showToast('No receipt to print','error'); return; }
  const win = window.open('', '_blank', 'width=500,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Fee Receipt</title><style>
    body{font-family:'Segoe UI',sans-serif;padding:1.5rem;color:#1e293b;background:#fff}
    .fee-receipt{max-width:380px;margin:0 auto;border:2px solid #1a6fb5;border-radius:10px;padding:1.2rem;background:#fff}
    .rcpt-header{display:flex;gap:.75rem;align-items:flex-start;margin-bottom:.75rem}
    .rcpt-logo{width:40px;height:40px;background:linear-gradient(135deg,#1a6fb5,#0ea5e9);border-radius:8px;color:#fff;font-weight:800;font-size:.9rem;display:flex;align-items:center;justify-content:center}
    .rcpt-school{flex:1} .rcpt-school strong{font-size:.95rem;color:#1e293b}
    .rcpt-no{text-align:right;min-width:7rem}
    .rcpt-divider{border-top:2px dashed #1a6fb5;margin:.6rem 0}
    .rcpt-divider-sm{border-top:1px solid #e2e8f0;margin:.4rem 0}
    .rcpt-body{display:flex;flex-direction:column;gap:.3rem}
    .rcpt-row{display:flex;justify-content:space-between;align-items:center;font-size:.82rem;padding:.15rem 0}
    .rcpt-lbl{color:#64748b;font-size:.78rem} .rcpt-val{font-weight:600;color:#1e293b}
    .rcpt-paid-row{background:#f0fdf4;border-radius:6px;padding:.3rem .5rem;margin:.25rem 0}
    .rcpt-bal-row{background:#fef3c7;border-radius:6px;padding:.3rem .5rem}
    .rcpt-footer{display:flex;justify-content:space-between;margin-top:.75rem;padding-top:.5rem;border-top:1px solid #e2e8f0;font-size:.72rem;color:#94a3b8}
    @media print{body{padding:0} .fee-receipt{border-color:#000;max-width:100%}}
  </style></head><body>${lastReceiptHtml}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}

// ═══════════════════════════════════════════
// STUDENT BALANCES
// ═══════════════════════════════════════════
function renderStudentBalances() {
  loadFees();
  const filterClass  = document.getElementById('fsbClass')?.value  || '';
  const filterTerm   = document.getElementById('fsbTerm')?.value   || '';
  const filterYear   = document.getElementById('fsbYear')?.value   || '';
  const filterStatus = document.getElementById('fsbStatus')?.value || '';
  const search       = (document.getElementById('fsbSearch')?.value || '').toLowerCase();

  const isTeacher = currentUser && currentUser.role === 'teacher';
  const isFullFeesRole = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin'||currentUser.role==='principal'||currentUser.role==='bursar');
  const teacherClassIds = (isTeacher && !isFullFeesRole)
    ? [...new Set(getClassTeacherStreamIds(currentUser.teacherId).map(sid => { const s=streams.find(x=>x.id===sid); return s?s.classId:null; }).filter(Boolean))]
    : null;

  const tbody = document.getElementById('feeStudentsBody');
  if (!tbody) return;

  // Build rows: one row per student per record
  let rows = [];
  feeRecords.forEach(rec => {
    if (filterTerm   && rec.term !== filterTerm)              return;
    if (filterYear   && String(rec.year) !== filterYear)      return;
    if (filterClass  && rec.classId !== filterClass)          return;
    if (teacherClassIds && !teacherClassIds.includes(rec.classId)) return;

    const stu = students.find(s => s.id === rec.studentId); if (!stu) return;
    const cls = classes.find(c => c.id === rec.classId);
    const paid = getRecordTotalPaid(rec);
    const bal  = getRecordBalance(rec);
    const pct  = rec.totalFee > 0 ? Math.round(paid/rec.totalFee*100) : 0;
    let statusKey = bal <= 0 ? 'cleared' : paid > 0 ? 'partial' : 'unpaid';

    if (filterStatus && statusKey !== filterStatus) return;
    if (search && !stu.name.toLowerCase().includes(search) && !stu.adm.toLowerCase().includes(search)) return;

    rows.push({ rec, stu, cls, paid, bal, pct, statusKey });
  });

  // Also add students with NO record if a structure exists for them
  students.forEach(stu => {
    const clsId = stu.classId;
    if (teacherClassIds && !teacherClassIds.includes(clsId)) return;
    if (filterClass && clsId !== filterClass) return;

    const structs = feeStructures.filter(f => f.classId===clsId
      && (!filterTerm || f.term===filterTerm)
      && (!filterYear || String(f.year)===filterYear));

    structs.forEach(struct => {
      const exists = feeRecords.some(r => r.studentId===stu.id && r.term===struct.term && String(r.year)===struct.year);
      if (exists) return;

      if (filterStatus && filterStatus !== 'unpaid') return;
      if (search && !stu.name.toLowerCase().includes(search) && !stu.adm.toLowerCase().includes(search)) return;

      const cls = classes.find(c => c.id === clsId);
      rows.push({ rec: { id: null, studentId: stu.id, classId: clsId, term: struct.term, year: struct.year, totalFee: struct.totalFee, payments: [] }, stu, cls, paid: 0, bal: struct.totalFee, pct: 0, statusKey: 'unpaid' });
    });
  });

  rows.sort((a,b) => a.stu.name.localeCompare(b.stu.name));

  tbody.innerHTML = rows.length ? rows.map((r, i) => {
    const statusBadge = r.statusKey === 'cleared'
      ? '<span class="badge b-green">✅ Cleared</span>'
      : r.statusKey === 'partial'
        ? '<span class="badge b-amber">⚡ Partial</span>'
        : '<span class="badge b-red">❌ Unpaid</span>';
    return `
      <tr class="${r.statusKey==='unpaid'?'fee-defaulter':r.statusKey==='partial'?'fee-partial':''}">
        <td>${i+1}</td>
        <td>${r.stu.adm}</td>
        <td><strong>${r.stu.name}</strong></td>
        <td>${r.cls?.name || '—'}</td>
        <td>${r.rec.term} ${r.rec.year}</td>
        <td>KES ${parseFloat(r.rec.totalFee||0).toLocaleString()}</td>
        <td style="color:var(--success)">KES ${r.paid.toLocaleString()}</td>
        <td style="color:${r.bal>0?'var(--danger)':'var(--success)'}"><strong>KES ${r.bal.toLocaleString()}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewStudentPaymentHistory('${r.stu.id}','${r.rec.term}','${r.rec.year}')">📋 History</button>
          <button class="btn btn-sm btn-outline" onclick="quickPayStudent('${r.stu.id}','${r.rec.classId}','${r.rec.term}','${r.rec.year}')">💳 Pay</button>
        </td>
      </tr>`;
  }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:2rem">No fee records found.</td></tr>';
}

function viewStudentPaymentHistory(stuId, term, year) {
  loadFees();
  const stu = students.find(s => s.id === stuId);
  const rec = feeRecords.find(r => r.studentId===stuId && r.term===term && String(r.year)===String(year));
  if (!stu) return;

  const payments = rec ? rec.payments : [];
  const paid = rec ? getRecordTotalPaid(rec) : 0;
  const bal  = rec ? getRecordBalance(rec) : 0;

  showModal(`💳 ${stu.name} — Payment History (${term} ${year})`, `
    <div style="margin-bottom:1rem">
      <div style="display:flex;gap:1rem;flex-wrap:wrap">
        <div class="fbc-row"><span class="fbc-label">Total Fee</span><span class="fbc-val">KES ${parseFloat(rec?.totalFee||0).toLocaleString()}</span></div>
        <div class="fbc-row"><span class="fbc-label">Paid</span><span class="fbc-val fbc-green">KES ${paid.toLocaleString()}</span></div>
        <div class="fbc-row"><span class="fbc-label">Balance</span><span class="fbc-val fbc-red">KES ${bal.toLocaleString()}</span></div>
      </div>
    </div>
    ${payments.length ? `
      <table style="width:100%;font-size:.82rem;border-collapse:collapse">
        <thead><tr style="background:var(--surface)"><th style="padding:.4rem;text-align:left">Receipt No</th><th>Date</th><th>Amount</th><th>Mode</th><th>Balance After</th><th></th></tr></thead>
        <tbody>${payments.map(p => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:.35rem;font-family:monospace;color:var(--primary)">${p.receiptNo}</td>
            <td style="padding:.35rem">${p.date}</td>
            <td style="padding:.35rem;color:var(--success);font-weight:700">KES ${parseFloat(p.amount).toLocaleString()}</td>
            <td style="padding:.35rem">${p.mode}</td>
            <td style="padding:.35rem;color:${p.balanceAfter>0?'var(--danger)':'var(--success)'}">KES ${parseFloat(p.balanceAfter||0).toLocaleString()}</td>
            <td style="padding:.35rem"><button class="btn btn-sm btn-outline" onclick="reprintReceipt('${stuId}','${term}','${year}','${p.id}')">🖨</button></td>
          </tr>`).join('')}
        </tbody>
      </table>` : '<p style="color:var(--muted);text-align:center;padding:1rem">No payments recorded yet.</p>'}
  `, [{label:'✕ Close', cls:'btn-outline', action:'closeModal()'}]);
}

function quickPayStudent(stuId, classId, term, year) {
  closeModal();
  openFeesTab('tabFeePayments', document.getElementById('tbFeePayments'));
  setTimeout(() => {
    const cls = document.getElementById('fpClass');
    if (cls) { cls.value = classId; onFpClassChange(); }
    const yr  = document.getElementById('fpYear');
    if (yr)  yr.value  = year;
    const trm = document.getElementById('fpTerm');
    if (trm) trm.value = term;
    setTimeout(() => {
      const stu = document.getElementById('fpStudent');
      if (stu) { stu.value = stuId; onFpStudentChange(); }
    }, 100);
  }, 150);
}

function reprintReceipt(stuId, term, year, payId) {
  loadFees();
  const rec = feeRecords.find(r => r.studentId===stuId && r.term===term && String(r.year)===String(year));
  if (!rec) return;
  const payment = rec.payments.find(p => p.id === payId);
  if (!payment) return;
  const stu = students.find(s => s.id === stuId);
  const cls = classes.find(c => c.id === rec.classId);
  lastReceiptHtml = buildReceiptHTML({ stu, cls, term, year, totalFee: rec.totalFee, payment, balBefore: payment.balanceBefore, balAfter: payment.balanceAfter, receiptNo: payment.receiptNo, date: payment.date, mode: payment.mode, notes: payment.notes, amount: payment.amount, schoolName: settings.schoolName || 'School' });
  printLastReceipt();
}

// ═══════════════════════════════════════════
// FEE REMINDERS
// ═══════════════════════════════════════════
function renderFeeReminders() {
  loadFees();
  const filterClass = document.getElementById('fremClass')?.value || '';
  const filterTerm  = document.getElementById('fremTerm')?.value  || '';
  const filterYear  = document.getElementById('fremYear')?.value  || '';

  const isTeacher = currentUser && currentUser.role === 'teacher';
  const isFullFeesRole = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin'||currentUser.role==='principal'||currentUser.role==='bursar');
  const teacherClassIds = (isTeacher && !isFullFeesRole)
    ? [...new Set(getClassTeacherStreamIds(currentUser.teacherId).map(sid => { const s=streams.find(x=>x.id===sid); return s?s.classId:null; }).filter(Boolean))]
    : null;

  // Find defaulters: students with outstanding balance > 0
  const defaulters = [];
  feeRecords.forEach(rec => {
    if (filterClass && rec.classId !== filterClass) return;
    if (filterTerm  && rec.term !== filterTerm)     return;
    if (filterYear  && String(rec.year) !== filterYear) return;
    if (teacherClassIds && !teacherClassIds.includes(rec.classId)) return;
    const bal = getRecordBalance(rec);
    if (bal <= 0) return;
    const stu = students.find(s => s.id === rec.studentId); if (!stu) return;
    const cls = classes.find(c => c.id === rec.classId);
    defaulters.push({ rec, stu, cls, bal, paid: getRecordTotalPaid(rec) });
  });

  // Also unpaid students with structure
  students.forEach(stu => {
    if (teacherClassIds && !teacherClassIds.includes(stu.classId)) return;
    if (filterClass && stu.classId !== filterClass) return;
    const structs = feeStructures.filter(f => f.classId===stu.classId
      && (!filterTerm || f.term===filterTerm)
      && (!filterYear || String(f.year)===filterYear));
    structs.forEach(struct => {
      const exists = feeRecords.some(r => r.studentId===stu.id && r.term===struct.term && String(r.year)===struct.year);
      if (exists) return;
      const cls = classes.find(c => c.id === stu.classId);
      defaulters.push({ rec: { term: struct.term, year: struct.year, totalFee: struct.totalFee, payments: [] }, stu, cls, bal: struct.totalFee, paid: 0 });
    });
  });

  defaulters.sort((a,b) => b.bal - a.bal);

  const el = document.getElementById('feeRemindersList');
  if (!el) return;

  if (!defaulters.length) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:2.5rem;color:var(--muted)">🎉 No outstanding fee balances found! All students have cleared their fees.</div>';
    return;
  }

  el.innerHTML = `
    <div class="card" style="margin-bottom:1rem">
      <p style="color:var(--muted);font-size:.85rem">Showing <strong>${defaulters.length}</strong> student(s) with outstanding balances. Click any reminder to print individually.</p>
    </div>
    <div class="fee-reminders-grid">
      ${defaulters.map(d => buildReminderCardHTML(d)).join('')}
    </div>`;
}

function buildReminderCardHTML({ stu, cls, rec, bal, paid }) {
  const schoolName = settings.schoolName || 'The School';
  const term = rec.term, year = rec.year;
  const today = new Date().toLocaleDateString('en-KE', { day:'2-digit', month:'long', year:'numeric' });
  return `
    <div class="reminder-card" onclick="printSingleReminder('${stu.id}','${term}','${year}')">
      <div class="rm-header">
        <div class="rm-badge">⚠️ FEE REMINDER</div>
        <div class="rm-date">${today}</div>
      </div>
      <div class="rm-school">${schoolName}</div>
      <div class="rm-body">
        <p>Dear Parent/Guardian of <strong>${stu.name}</strong>,</p>
        <p>This is a kind reminder that your child's school fees for <strong>${term} ${year}</strong> are outstanding.</p>
        <div class="rm-amounts">
          <div class="rm-amount-row"><span>Class:</span><strong>${cls?.name || '—'}</strong></div>
          <div class="rm-amount-row"><span>Total Fee:</span><strong>KES ${parseFloat(rec.totalFee||0).toLocaleString()}</strong></div>
          <div class="rm-amount-row"><span>Amount Paid:</span><strong style="color:var(--success)">KES ${parseFloat(paid).toLocaleString()}</strong></div>
          <div class="rm-amount-row rm-outstanding"><span>Outstanding Balance:</span><strong style="color:var(--danger)">KES ${parseFloat(bal).toLocaleString()}</strong></div>
        </div>
        <p style="font-size:.78rem;color:var(--muted)">Kindly settle the outstanding amount at your earliest convenience to avoid inconveniences to your child's education. Contact the school for payment arrangements.</p>
      </div>
      <div class="rm-footer">
        <span>Adm: ${stu.adm}</span>
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();printSingleReminder('${stu.id}','${term}','${year}')">🖨 Print</button>
      </div>
    </div>`;
}

function printSingleReminder(stuId, term, year) {
  loadFees();
  const stu = students.find(s => s.id === stuId); if (!stu) return;
  const rec = feeRecords.find(r => r.studentId===stuId && r.term===term && String(r.year)===String(year));
  const struct = rec ? null : feeStructures.find(f => f.classId===stu.classId && f.term===term && String(f.year)===String(year));
  const totalFee = rec ? rec.totalFee : (struct ? struct.totalFee : 0);
  const paid     = rec ? getRecordTotalPaid(rec) : 0;
  const bal      = totalFee - paid;
  const cls      = classes.find(c => c.id === stu.classId);
  const d = { stu, cls, rec: rec||{ term, year, totalFee, payments: [] }, bal, paid };

  const win = window.open('', '_blank', 'width=550,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Fee Reminder — ${stu.name}</title><style>
    body{font-family:'Segoe UI',sans-serif;padding:2rem;color:#1e293b;background:#fff;max-width:480px;margin:0 auto}
    .rm-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
    .rm-badge{background:#dc2626;color:#fff;padding:.25rem .75rem;border-radius:20px;font-size:.75rem;font-weight:700}
    .rm-school{font-weight:800;font-size:1.1rem;color:#1a6fb5;margin-bottom:.75rem}
    .rm-amounts{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.75rem;margin:.75rem 0}
    .rm-amount-row{display:flex;justify-content:space-between;padding:.2rem 0;font-size:.85rem;border-bottom:1px solid #e2e8f0}
    .rm-amount-row:last-child{border:none} .rm-outstanding{background:#fff1f2;border-radius:4px;padding:.3rem .5rem}
    p{font-size:.85rem;line-height:1.5;margin:.5rem 0}
    .rm-footer{display:flex;justify-content:space-between;margin-top:1rem;padding-top:.75rem;border-top:2px dashed #e2e8f0;font-size:.75rem;color:#94a3b8}
    @media print{button{display:none}}
  </style></head><body>
    <div class="rm-header"><div class="rm-badge">⚠️ FEE REMINDER</div><div>${new Date().toLocaleDateString('en-KE',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
    <div class="rm-school">${settings.schoolName || 'School'}</div>
    <p>Dear Parent/Guardian of <strong>${stu.name}</strong>,</p>
    <p>This is a kind reminder that your child's school fees for <strong>${term} ${year}</strong> are outstanding.</p>
    <div class="rm-amounts">
      <div class="rm-amount-row"><span>Class</span><strong>${cls?.name||'—'}</strong></div>
      <div class="rm-amount-row"><span>Admission No.</span><strong>${stu.adm}</strong></div>
      <div class="rm-amount-row"><span>Total Fee</span><strong>KES ${parseFloat(totalFee).toLocaleString()}</strong></div>
      <div class="rm-amount-row"><span>Amount Paid</span><strong style="color:green">KES ${parseFloat(paid).toLocaleString()}</strong></div>
      <div class="rm-amount-row rm-outstanding"><span>Outstanding Balance</span><strong style="color:#dc2626">KES ${parseFloat(bal).toLocaleString()}</strong></div>
    </div>
    <p>Kindly settle the outstanding balance at your earliest convenience. Please visit the school bursar's office or contact us for payment arrangements.</p>
    <p style="font-size:.78rem;color:#64748b">We value your child's education and look forward to your prompt response.</p>
    <div class="rm-footer"><span>Generated: ${new Date().toLocaleString()}</span><span>${settings.schoolName||''}</span></div>
    <button onclick="window.print()" style="margin-top:1rem;padding:.5rem 1.5rem;background:#1a6fb5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.85rem">🖨 Print Reminder</button>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}

function printAllReminders() {
  loadFees();
  const filterClass = document.getElementById('fremClass')?.value || '';
  const filterTerm  = document.getElementById('fremTerm')?.value  || '';
  const filterYear  = document.getElementById('fremYear')?.value  || '';
  const isTeacher = currentUser && currentUser.role === 'teacher';
  const isFullFeesRole = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin'||currentUser.role==='principal'||currentUser.role==='bursar');
  const teacherClassIds = (isTeacher && !isFullFeesRole)
    ? [...new Set(getClassTeacherStreamIds(currentUser.teacherId).map(sid => { const s=streams.find(x=>x.id===sid); return s?s.classId:null; }).filter(Boolean))]
    : null;

  const defaulters = [];
  feeRecords.forEach(rec => {
    if (filterClass && rec.classId !== filterClass) return;
    if (filterTerm  && rec.term !== filterTerm)     return;
    if (filterYear  && String(rec.year) !== filterYear) return;
    if (teacherClassIds && !teacherClassIds.includes(rec.classId)) return;
    const bal = getRecordBalance(rec);
    if (bal <= 0) return;
    const stu = students.find(s => s.id === rec.studentId); if (!stu) return;
    const cls = classes.find(c => c.id === rec.classId);
    defaulters.push({ rec, stu, cls, bal, paid: getRecordTotalPaid(rec) });
  });

  if (!defaulters.length) { showToast('No defaulters to print reminders for', 'info'); return; }

  const reminderBlocks = defaulters.map(d => {
    const { stu, cls, rec, bal, paid } = d;
    return `
      <div style="page-break-inside:avoid;border:1px solid #e2e8f0;border-radius:8px;padding:1.2rem;margin-bottom:1.5rem">
        <div style="display:flex;justify-content:space-between"><span style="background:#dc2626;color:#fff;padding:.2rem .6rem;border-radius:20px;font-size:.72rem;font-weight:700">⚠️ FEE REMINDER</span><span style="font-size:.8rem;color:#64748b">${new Date().toLocaleDateString('en-KE',{day:'2-digit',month:'long',year:'numeric'})}</span></div>
        <div style="font-weight:800;font-size:1rem;color:#1a6fb5;margin:.5rem 0">${settings.schoolName||'School'}</div>
        <p style="font-size:.82rem;margin:.35rem 0">Dear Parent/Guardian of <strong>${stu.name}</strong> (Adm: ${stu.adm}, ${cls?.name||''}),</p>
        <p style="font-size:.82rem;margin:.35rem 0">Your child's fees for <strong>${rec.term} ${rec.year}</strong> are outstanding:</p>
        <div style="background:#f8fafc;border-radius:6px;padding:.5rem .75rem;margin:.5rem 0;font-size:.8rem">
          <div style="display:flex;justify-content:space-between;padding:.15rem 0"><span>Total Fee:</span><strong>KES ${parseFloat(rec.totalFee||0).toLocaleString()}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:.15rem 0"><span>Paid:</span><strong style="color:green">KES ${parseFloat(paid).toLocaleString()}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:.15rem 0;background:#fff1f2;border-radius:4px;padding:.2rem .4rem"><span>Outstanding:</span><strong style="color:#dc2626">KES ${parseFloat(bal).toLocaleString()}</strong></div>
        </div>
        <p style="font-size:.75rem;color:#64748b;margin:.35rem 0">Kindly settle this balance promptly. Contact school administration for assistance.</p>
      </div>`;
  }).join('');

  const win = window.open('', '_blank', 'width=700,height=800');
  win.document.write(`<!DOCTYPE html><html><head><title>Fee Reminders</title><style>body{font-family:'Segoe UI',sans-serif;padding:2rem;color:#1e293b;max-width:600px;margin:0 auto}@media print{button{display:none}}</style></head><body>
    <div style="text-align:center;margin-bottom:2rem">
      <h2 style="color:#1a6fb5">${settings.schoolName||'School'} — Fee Reminders</h2>
      <p style="color:#64748b;font-size:.85rem">Generated: ${new Date().toLocaleString()} | ${filterTerm||'All Terms'} ${filterYear||''} | ${defaulters.length} students</p>
    </div>
    ${reminderBlocks}
    <button onclick="window.print()" style="padding:.6rem 1.5rem;background:#1a6fb5;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print All Reminders</button>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

// ═══════════════════════════════════════════
// RECEIPTS LOG
// ═══════════════════════════════════════════
function renderReceiptsLog() {
  loadFees();
  const filterClass = document.getElementById('frctClass')?.value || '';
  const filterTerm  = document.getElementById('frctTerm')?.value  || '';
  const search      = (document.getElementById('frctSearch')?.value || '').toLowerCase();
  const isTeacher = currentUser && currentUser.role === 'teacher';
  const isFullFeesRole = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin'||currentUser.role==='principal'||currentUser.role==='bursar');
  const teacherClassIds = (isTeacher && !isFullFeesRole)
    ? [...new Set(getClassTeacherStreamIds(currentUser.teacherId).map(sid => { const s=streams.find(x=>x.id===sid); return s?s.classId:null; }).filter(Boolean))]
    : null;

  let allPayments = [];
  feeRecords.forEach(rec => {
    if (filterClass && rec.classId !== filterClass) return;
    if (filterTerm  && rec.term !== filterTerm)     return;
    if (teacherClassIds && !teacherClassIds.includes(rec.classId)) return;
    const stu = students.find(s => s.id === rec.studentId); if (!stu) return;
    const cls = classes.find(c => c.id === rec.classId);
    rec.payments.forEach(p => {
      if (search && !stu.name.toLowerCase().includes(search) && !p.receiptNo.toLowerCase().includes(search) && !stu.adm.toLowerCase().includes(search)) return;
      allPayments.push({ p, rec, stu, cls });
    });
  });

  allPayments.sort((a,b) => new Date(b.p.date) - new Date(a.p.date));

  const tbody = document.getElementById('receiptsLogBody');
  if (!tbody) return;
  tbody.innerHTML = allPayments.length ? allPayments.map(({ p, rec, stu, cls }) => `
    <tr>
      <td style="font-family:monospace;color:var(--primary);font-size:.8rem">${p.receiptNo}</td>
      <td>${p.date}</td>
      <td><strong>${stu.name}</strong><br><span style="font-size:.75rem;color:var(--muted)">${stu.adm}</span></td>
      <td>${cls?.name||'—'}</td>
      <td>${rec.term} ${rec.year}</td>
      <td style="color:var(--success);font-weight:700">KES ${parseFloat(p.amount).toLocaleString()}</td>
      <td>${p.mode}</td>
      <td style="color:${p.balanceAfter>0?'var(--danger)':'var(--success)'}">KES ${parseFloat(p.balanceAfter||0).toLocaleString()}</td>
      <td><button class="btn btn-sm btn-outline" onclick="reprintReceipt('${stu.id}','${rec.term}','${rec.year}','${p.id}')">🖨 Reprint</button></td>
    </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem">No payment receipts found.</td></tr>';
}

// ═══════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════
function exportFeesSummary() {
  loadFees();
  const filterClass = document.getElementById('fovClass')?.value || '';
  const filterTerm  = document.getElementById('fovTerm')?.value  || '';
  const filterYear  = document.getElementById('fovYear')?.value  || '';

  let rows = [['Student Name','Adm No','Class','Term','Year','Total Fee','Amount Paid','Balance','Status']];
  feeRecords.forEach(rec => {
    if (filterClass && rec.classId !== filterClass) return;
    if (filterTerm  && rec.term !== filterTerm)     return;
    if (filterYear  && String(rec.year) !== filterYear) return;
    const stu = students.find(s => s.id === rec.studentId); if (!stu) return;
    const cls = classes.find(c => c.id === rec.classId);
    const paid = getRecordTotalPaid(rec);
    const bal  = getRecordBalance(rec);
    const status = bal <= 0 ? 'Cleared' : paid > 0 ? 'Partial' : 'Unpaid';
    rows.push([stu.name, stu.adm, cls?.name||'', rec.term, rec.year, rec.totalFee, paid, bal, status]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `fees_summary_${filterTerm||'all'}_${filterYear||'all'}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Fee summary exported ✓', 'success');
}

function exportStudentBalances() {
  exportFeesSummary();
}

function printFeeReport() {
  loadFees();
  const filterClass = document.getElementById('fovClass')?.value || '';
  const filterTerm  = document.getElementById('fovTerm')?.value  || '';
  const filterYear  = document.getElementById('fovYear')?.value  || '';
  const visibleClasses = filterClass ? classes.filter(c=>c.id===filterClass) : classes;

  let totalExp=0, totalCol=0, totalOut=0;
  const tableRows = visibleClasses.map(cls => {
    const classStudents = students.filter(s => s.classId === cls.id);
    let expected=0, collected=0;
    classStudents.forEach(stu => {
      const recs = feeRecords.filter(r => r.studentId===stu.id && (!filterTerm||r.term===filterTerm) && (!filterYear||String(r.year)===filterYear));
      recs.forEach(r => { expected += parseFloat(r.totalFee||0); collected += getRecordTotalPaid(r); });
    });
    const out = expected - collected;
    const pct = expected > 0 ? Math.round(collected/expected*100) : 0;
    totalExp += expected; totalCol += collected; totalOut += out;
    return `<tr><td>${cls.name}</td><td>${classStudents.length}</td><td>KES ${expected.toLocaleString()}</td><td>KES ${collected.toLocaleString()}</td><td style="color:${out>0?'#dc2626':'#16a34a'}">KES ${out.toLocaleString()}</td><td>${pct}%</td></tr>`;
  }).join('');

  const win = window.open('', '_blank', 'width=800,height=600');
  win.document.write(`<!DOCTYPE html><html><head><title>Fee Report</title><style>
    body{font-family:'Segoe UI',sans-serif;padding:2rem;color:#1e293b}
    h2{color:#1a6fb5} table{width:100%;border-collapse:collapse;margin-top:1rem;font-size:.88rem}
    th{background:#1a6fb5;color:#fff;padding:.5rem;text-align:left}
    td{padding:.45rem;border-bottom:1px solid #e2e8f0}
    tfoot td{font-weight:700;background:#f8fafc;border-top:2px solid #1a6fb5}
    @media print{button{display:none}}
  </style></head><body>
    <h2>${settings.schoolName||'School'} — Fee Collection Report</h2>
    <p style="color:#64748b;font-size:.85rem">${filterTerm||'All Terms'} ${filterYear||''} | Generated: ${new Date().toLocaleString()}</p>
    <table>
      <thead><tr><th>Class</th><th>Students</th><th>Expected</th><th>Collected</th><th>Outstanding</th><th>Rate</th></tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr><td>TOTALS</td><td>${students.length}</td><td>KES ${totalExp.toLocaleString()}</td><td>KES ${totalCol.toLocaleString()}</td><td style="color:${totalOut>0?'#dc2626':'#16a34a'}">KES ${totalOut.toLocaleString()}</td><td>${totalExp>0?Math.round(totalCol/totalExp*100):0}%</td></tr></tfoot>
    </table>
    <button onclick="window.print()" style="margin-top:1rem;padding:.5rem 1.2rem;background:#1a6fb5;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
  </body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); }, 300);
}

// ═══════════════════════════════════════════
// REPORT FORM INTEGRATION
// ═══════════════════════════════════════════
// Auto-populate fee balance on report form when student is selected
function autoPopulateReportFees(stuId, term, year) {
  if (!stuId || !term || !year) return;
  loadFees();
  const rec = feeRecords.find(r => r.studentId===stuId && r.term===term && String(r.year)===String(year));
  if (!rec) return;
  const bal  = getRecordBalance(rec);
  const balEl = document.getElementById('rpFeeBalance');
  if (balEl && !balEl.value) balEl.value = bal;
}

// Hook into report selectors — delegates to refreshRpFeeAutoLink()
function hookReportFeeAutoFill() {
  const rpStudent = document.getElementById('rpStudent');
  const rpExam    = document.getElementById('rpExam');
  const balEl     = document.getElementById('rpFeeBalance');
  const nextTermEl= document.getElementById('rpFeeNextTerm');
  if (!rpStudent || !rpExam) return;
  // Track manual edits so auto-fill doesn't overwrite user input
  if (balEl)      balEl.addEventListener('input',  () => { balEl.dataset.manuallySet      = balEl.value      ? '1' : ''; });
  if (nextTermEl) nextTermEl.addEventListener('input', () => { nextTermEl.dataset.manuallySet = nextTermEl.value ? '1' : ''; });
  // All change events delegate to the central handler
  rpStudent.addEventListener('change', refreshRpFeeAutoLink);
  rpExam.addEventListener('change', refreshRpFeeAutoLink);
}

// Get fee status for report card badge
function getStudentFeeStatus(stuId, term, year) {
  loadFees();
  const rec = feeRecords.find(r => r.studentId===stuId && r.term===term && String(r.year)===String(year));
  if (!rec) return { status: 'No Record', cleared: false, balance: null };
  const bal = getRecordBalance(rec);
  return { status: bal <= 0 ? 'FEES CLEARED ✅' : `BALANCE: KES ${bal.toLocaleString()}`, cleared: bal <= 0, balance: bal };
}

// Modal helpers reuse existing showModal() and closeModal() defined earlier in the file.


// ══════════════════════════════════════════════════════════
//  UNIVERSAL TABLE SORT — Charanas Analyzer
// ══════════════════════════════════════════════════════════

const _sortState = {}; // { tbodyId: { col, dir } }

function sortTable(tbodyId, colIndex, type) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (!rows.length) return;

  // Toggle direction
  const prev = _sortState[tbodyId] || {};
  const dir  = (prev.col === colIndex && prev.dir === 'asc') ? 'desc' : 'asc';
  _sortState[tbodyId] = { col: colIndex, dir };

  // Update sort icons in the parent thead
  const thead = tbody.closest('table')?.querySelector('thead');
  if (thead) {
    thead.querySelectorAll('.sort-ico').forEach(ico => ico.textContent = '⇅');
    thead.querySelectorAll('.sortable-th').forEach(th => th.classList.remove('sort-asc','sort-desc'));
    const ths = thead.querySelectorAll('th');
    if (ths[colIndex]) {
      ths[colIndex].classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
      const ico = ths[colIndex].querySelector('.sort-ico');
      if (ico) ico.textContent = dir === 'asc' ? '▲' : '▼';
    }
  }

  function getCellValue(row, idx) {
    const cell = row.cells[idx];
    if (!cell) return '';
    return (cell.dataset.sortVal || cell.innerText || cell.textContent || '').trim();
  }

  function parseVal(raw, t) {
    switch (t) {
      case 'num':  return parseFloat(raw.replace(/[^0-9.\-]/g,'')) || 0;
      case 'kes':  return parseFloat(raw.replace(/[^0-9.\-]/g,'')) || 0;
      case 'pct':  return parseFloat(raw.replace(/[^0-9.\-]/g,'')) || 0;
      case 'date': return new Date(raw).getTime() || 0;
      default:     return raw.toLowerCase();
    }
  }

  rows.sort((a, b) => {
    const va = parseVal(getCellValue(a, colIndex), type);
    const vb = parseVal(getCellValue(b, colIndex), type);
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ?  1 : -1;
    return 0;
  });

  rows.forEach(r => tbody.appendChild(r));
}


// ══════════════════════════════════════════════════════════
//  TEACHER PREFERENCES & ROLE-BASED ACCESS — Charanas Analyzer
// ══════════════════════════════════════════════════════════

// ── Resolve current teacher object ──
function getCurrentTeacher() {
  if (!currentUser || currentUser.role !== 'teacher') return null;
  return teachers.find(t => t.id === currentUser.teacherId) || null;
}

// ── Get subjects this teacher teaches (union of stream assignments + default) ──
function getMySubjectIds() {
  const t = getCurrentTeacher();
  if (!t) return [];
  return getTeacherSubjectIds(t.id);
}

// ── Get streams this teacher is class teacher of ──
function getMyClassTeacherStreams() {
  const t = getCurrentTeacher();
  if (!t) return [];
  return streams.filter(s => s.streamTeacherId === t.id);
}

// ── Apply all role-based UI changes after login ──
function applyRoleBasedUI() {
  const role      = currentUser.role;
  const isAdmin   = role === 'superadmin' || role === 'admin';
  const isPrincipal = role === 'principal';
  const isBursar  = role === 'bursar';
  const isTeacher = role === 'teacher';
  const isFullFees = isAdmin || isPrincipal || isBursar; // full fees access
  const isClassTch = isTeacher && currentUserIsClassTeacher();

  // Global restrictions from settings
  const globalRestrictAnalytics = isTeacher && !!settings.restrictTeacherAnalytics;

  // ── Sidebar: sections hidden for teachers ──
  ['students','subjects','classes'].forEach(sec => {
    const link = document.querySelector(`[data-s="${sec}"]`);
    if (link) link.style.display = isTeacher ? 'none' : '';
  });

  // Teachers section: always hidden from teacher-role users
  const teachersLink = document.querySelector('[data-s="teachers"]');
  if (teachersLink) teachersLink.style.display = isTeacher ? 'none' : '';

  // ── Fees sidebar link ──
  // Regular teacher (not class teacher) → no fees at all
  // Class teacher → show fees (restricted to own classes inside fees module)
  // principal / bursar / admin → always show
  const feesLink = document.querySelector('[data-s="fees"]');
  if (feesLink) {
    if (isTeacher && !isClassTch) feesLink.style.display = 'none';
    else feesLink.style.display = '';
  }

  // ── Exams: hide Create Exam tab for teachers ──
  const createExamBtn = document.querySelector('[onclick*="tabCreateExam"]');
  if (createExamBtn) createExamBtn.style.display = isTeacher ? 'none' : '';

  // If teacher lands on exams, redirect to Upload Marks tab
  if (isTeacher) {
    const createPanel = document.getElementById('tabCreateExam');
    if (createPanel && createPanel.classList.contains('active')) {
      openExamTab('tabUploadMarks', document.querySelector('[onclick*="tabUploadMarks"]'));
    }
  }

  // ── Students: hide add/edit form and action buttons for teachers ──
  const stuAddCard = document.getElementById('stuAddCard');
  if (stuAddCard) stuAddCard.style.display = isTeacher ? 'none' : '';
  const stuUploadCard = document.getElementById('stuUploadCard');
  if (stuUploadCard && isTeacher) stuUploadCard.style.display = 'none';

  // ── Analyse tab ──
  const anBtn = document.getElementById('tbAnalyse');
  if (anBtn) {
    const show = !isTeacher || (!globalRestrictAnalytics && (currentUser.canAnalyse || isClassTch));
    anBtn.style.display = show ? '' : 'none';
  }

  // ── Merit list tab ──
  const mlBtn = document.getElementById('tbMeritList') || document.querySelector('[onclick*="tabMeritList"]');
  if (mlBtn) mlBtn.style.display = (!isTeacher || (!globalRestrictAnalytics && (currentUser.canMerit || isClassTch))) ? '' : 'none';

  // ── Subject Analysis tab ──
  const saBtn = document.getElementById('tbSubjectAnalysis') || document.querySelector('[onclick*="tabSubjectAnalysis"]');
  if (saBtn) saBtn.style.display = (!isTeacher || (!globalRestrictAnalytics && (currentUser.canAnalyse || isClassTch))) ? '' : 'none';
}

// ── Hook Upload Marks: filter classes/streams/subjects for teacher ──
// Overrides loadUmClasses to restrict to teacher's assigned streams
function loadUmClasses() {
  const clsSel = document.getElementById('umClass');
  const strSel = document.getElementById('umStream');
  const subSel = document.getElementById('umSubject');
  if (clsSel) clsSel.innerHTML = '<option value="">— Choose Class —</option>';
  if (strSel) strSel.innerHTML = '<option value="">— Choose Stream —</option>';
  if (subSel) subSel.innerHTML = '<option value="">— Choose Subject —</option>';
  const body = document.getElementById('umBody');
  const empty = document.getElementById('umEmpty');
  if (body) body.innerHTML = '';
  if (empty) empty.style.display = '';

  const examId = document.getElementById('umExam')?.value;
  if (!examId) return;
  const exam = exams.find(e => e.id === examId);
  if (!exam) return;

  const isTeacher = currentUser && currentUser.role === 'teacher';
  const t = getCurrentTeacher();

  let relevantClasses = classes;
  if (exam.classId) relevantClasses = classes.filter(c => c.id === exam.classId);

  if (isTeacher && t) {
    // Class teacher: restrict to their class(es)
    const myStreamIds  = getMyClassTeacherStreams().map(s => s.id);
    const myClassIds   = [...new Set(getMyClassTeacherStreams().map(s => s.classId))];
    // Subject teacher: show all classes where they have subjects in the exam
    const mySubIds     = getMySubjectIds();
    const hasSubs      = exam.subjectIds.some(sid => mySubIds.includes(sid));

    if (myClassIds.length) {
      // Class teacher restricts to their class
      relevantClasses = relevantClasses.filter(c => myClassIds.includes(c.id));
    } else if (!hasSubs) {
      if (clsSel) clsSel.innerHTML = '<option value="">— No subjects assigned for this exam —</option>';
      showToast('You have no subjects assigned in this exam', 'error');
      return;
    }
    // If regular subject teacher (no class teacher role), show all classes but only their subjects
  }

  if (clsSel) {
    clsSel.innerHTML = '<option value="">— Choose Class —</option>' +
      relevantClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (relevantClasses.length === 1) { clsSel.value = relevantClasses[0].id; loadUmStreams(); }
  }
}

// Override loadUmStreams to restrict class teachers to their stream(s)
function loadUmStreams() {
  const strSel = document.getElementById('umStream');
  const subSel = document.getElementById('umSubject');
  if (strSel) strSel.innerHTML = '<option value="">— Choose Stream —</option>';
  if (subSel) subSel.innerHTML = '<option value="">— Choose Subject —</option>';
  const body  = document.getElementById('umBody');
  const empty = document.getElementById('umEmpty');
  if (body) body.innerHTML = '';
  if (empty) empty.style.display = '';

  const classId = document.getElementById('umClass')?.value;
  if (!classId) return;

  const isTeacher = currentUser && currentUser.role === 'teacher';
  const t = getCurrentTeacher();
  let classStreams = streams.filter(s => s.classId === classId);

  if (isTeacher && t) {
    const myStreamIds = getMyClassTeacherStreams().map(s => s.id);
    if (myStreamIds.length) {
      // Class teacher: only their stream(s)
      classStreams = classStreams.filter(s => myStreamIds.includes(s.id));
    }
    // Regular subject teacher: all streams in the class
  }

  if (strSel) {
    strSel.innerHTML = '<option value="">— Choose Stream —</option>' +
      classStreams.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (classStreams.length === 1) { strSel.value = classStreams[0].id; loadUmSubjects(); }
  }
}

// Override loadUmSubjects to restrict to teacher's subjects
function loadUmSubjects() {
  const examId   = document.getElementById('umExam')?.value;
  const streamId = document.getElementById('umStream')?.value;
  const subSel   = document.getElementById('umSubject');
  if (subSel) subSel.innerHTML = '<option value="">— Choose Subject —</option>';
  const body  = document.getElementById('umBody');
  const empty = document.getElementById('umEmpty');
  if (body) body.innerHTML = '';
  if (empty) empty.style.display = '';
  if (!examId || !streamId) return;

  const exam = exams.find(e => e.id === examId);
  if (!exam) return;

  let allowedSubIds = exam.subjectIds;
  const isTeacher = currentUser && currentUser.role === 'teacher';
  if (isTeacher) {
    const mySubIds = getMySubjectIds();
    allowedSubIds = exam.subjectIds.filter(sid => mySubIds.includes(sid));
    if (!allowedSubIds.length) {
      if (subSel) subSel.innerHTML = '<option value="">— No subjects assigned to you —</option>';
      showToast('No subjects assigned to you for this exam', 'error');
      return;
    }
  }

  if (subSel) {
    subSel.innerHTML = '<option value="">— Choose Subject —</option>' +
      allowedSubIds.map(sid => {
        const s = subjects.find(x => x.id === sid);
        return s ? `<option value="${s.id}">${s.name}</option>` : '';
      }).join('');
    // Auto-select if only one subject
    if (allowedSubIds.length === 1) { subSel.value = allowedSubIds[0]; loadUmStudents(); }
  }
}

// ── Analysis: restrict class teachers to their class ──
// Patch checkAnalyseAccess to inject class-filter UI
function checkAnalyseAccess() {
  const isSuperAdmin = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin');
  const isTeacher    = currentUser && currentUser.role === 'teacher';
  const globalBlock  = isTeacher && !!settings.restrictTeacherAnalytics;
  const canAnalyse   = currentUser && currentUser.canAnalyse;
  const isClassTch   = currentUserIsClassTeacher();
  const allowed      = isSuperAdmin || (!globalBlock && (canAnalyse || isClassTch));

  const deniedEl  = document.getElementById('analyseAccessDenied');
  const contentEl = document.getElementById('analyseContent');
  if (deniedEl)  deniedEl.style.display  = allowed ? 'none' : '';
  if (contentEl) contentEl.style.display = allowed ? '' : 'none';

  const runBtn = document.getElementById('anRunBtn');
  if (runBtn) runBtn.style.display = (isSuperAdmin || canAnalyse || isClassTch) ? '' : 'none';

  const classTchNote = document.getElementById('anClassTchNote');
  if (classTchNote) classTchNote.style.display = (isClassTch && !canAnalyse && !isSuperAdmin) ? '' : 'none';

  if (allowed) {
    populateExamDropdowns();
    // Inject class-teacher scope indicator if applicable
    injectAnalysisScopeNote();
  }
}

function injectAnalysisScopeNote() {
  const isClassTch   = currentUserIsClassTeacher();
  const isSuperAdmin = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin');
  const noteId = 'anTeacherScopeNote';
  let note = document.getElementById(noteId);

  const anContent = document.getElementById('analyseContent');
  if (!anContent) return;

  if (isClassTch && !isSuperAdmin) {
    const myStreams  = getMyClassTeacherStreams();
    const myClasses  = [...new Set(myStreams.map(s => classes.find(c=>c.id===s.classId)?.name).filter(Boolean))];
    const mySubs     = getMySubjectIds().map(sid => subjects.find(s=>s.id===sid)?.name).filter(Boolean);

    if (!note) {
      note = document.createElement('div');
      note.id = noteId;
      note.style.cssText = 'margin-bottom:.75rem;padding:.6rem .9rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-size:.82rem;display:flex;align-items:flex-start;gap:.6rem';
      anContent.insertBefore(note, anContent.firstChild);
    }
    note.innerHTML = `
      <span style="font-size:1.1rem">🎯</span>
      <div>
        <strong style="color:var(--primary)">Analysis scoped to your class</strong><br>
        <span style="color:var(--muted)">
          Class: <strong>${myClasses.join(', ') || '—'}</strong> &nbsp;|&nbsp;
          Stream(s): <strong>${myStreams.map(s=>s.name).join(', ') || '—'}</strong> &nbsp;|&nbsp;
          Your subjects: <strong>${mySubs.slice(0,4).join(', ')+(mySubs.length>4?'…':'') || 'All'}</strong>
        </span>
      </div>`;
  } else if (note) {
    note.remove();
  }
}

// Patch runAnalysis to enforce class teacher scope
function runAnalysis() {
  const examId = document.getElementById('anExam')?.value;
  const res    = document.getElementById('analyseResults');
  const selGs  = document.getElementById('anGradingSystem')?.value;
  if (selGs) setActiveGradingSystem(selGs);
  if (!examId) { if(res) res.innerHTML='<p style="color:var(--muted)">Select an exam to begin.</p>'; return; }

  const exam      = exams.find(e=>e.id===examId);
  const examMarks = marks.filter(m=>m.examId===examId);
  if (!examMarks.length) { if(res) res.innerHTML='<p style="color:var(--muted)">No marks entered for this exam yet.</p>'; return; }

  const isTeacher    = currentUser && currentUser.role === 'teacher';
  const isSuperAdmin = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin');
  const isClassTch   = currentUserIsClassTeacher();

  // Determine which students to include
  let allowedStudents = students;
  if (isTeacher) {
    if (isClassTch) {
      // Class teacher: only their class's students
      const myStreamIds = getMyClassTeacherStreams().map(s => s.id);
      allowedStudents   = students.filter(s => myStreamIds.includes(s.streamId));
    }
    // If also regular teacher: further restrict subjects (handled below)
  }

  // Determine which subjects to show
  let allowedSubjectIds = exam.subjectIds;
  if (isTeacher && !isSuperAdmin) {
    const mySubIds = getMySubjectIds();
    if (mySubIds.length) {
      allowedSubjectIds = exam.subjectIds.filter(sid => mySubIds.includes(sid));
    }
    if (!allowedSubjectIds.length) {
      if(res) res.innerHTML='<p style="color:var(--muted)">You have no subjects assigned for this exam.</p>'; return;
    }
  }

  const studentsWithMarks = [...new Set(examMarks.map(m=>m.studentId))]
    .map(sid=>allowedStudents.find(s=>s.id===sid)).filter(Boolean);
  const totalSubjects = exam.subjectIds.length || 1;

  const studentTotals = studentsWithMarks.map(stu => {
    const stuMarks = examMarks.filter(m=>m.studentId===stu.id);
    const total    = stuMarks.reduce((a,m)=>a+m.score,0);
    const mean     = total / totalSubjects;
    return { ...stu, total, mean };
  });
  const classMean = studentTotals.length ? studentTotals.reduce((a,s)=>a+s.mean,0)/studentTotals.length : 0;

  const subjectMeans = allowedSubjectIds.map(sid => {
    const sub  = subjects.find(s=>s.id===sid);
    const vals = examMarks.filter(m=>m.subjectId===sid && allowedStudents.find(s=>s.id===m.studentId)).map(m=>m.score);
    const mn   = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    const mx   = vals.length ? Math.max(...vals) : 0;
    const lo   = vals.length ? Math.min(...vals) : 0;
    return { sub, mn, mx, lo, count: vals.length };
  }).filter(x=>x.sub);

  const male   = studentTotals.filter(s=>s.gender==='M');
  const female = studentTotals.filter(s=>s.gender==='F');
  const mMean  = male.length   ? male.reduce((a,s)=>a+s.mean,0)/male.length : 0;
  const fMean  = female.length ? female.reduce((a,s)=>a+s.mean,0)/female.length : 0;

  // Streams: only teacher's streams if class teacher
  const relevantStreams = (isTeacher && isClassTch && !isSuperAdmin)
    ? getMyClassTeacherStreams()
    : streams;

  const streamPerf = relevantStreams.map(str => {
    const grp = studentTotals.filter(s=>s.streamId===str.id);
    const mn  = grp.length ? grp.reduce((a,s)=>a+s.mean,0)/grp.length : 0;
    return { str, mn, count:grp.length };
  }).filter(x=>x.count>0);

  const scopeLabel = (isTeacher && isClassTch && !isSuperAdmin)
    ? `<span class="badge b-teal" style="margin-left:.5rem;font-size:.72rem">📌 Scoped: ${getMyClassTeacherStreams().map(s=>s.name).join(', ')}</span>` : '';

  if (res) res.innerHTML = `
    <div class="an-grid">
      <div class="an-card"><div class="an-num">${classMean.toFixed(2)}</div><div class="an-lbl">Mean Score${scopeLabel}</div></div>
      <div class="an-card"><div class="an-num" style="color:var(--secondary)">${studentTotals.length}</div><div class="an-lbl">Students</div></div>
      <div class="an-card"><div class="an-num" style="color:var(--success)">${subjectMeans.length}</div><div class="an-lbl">Subjects</div></div>
      <div class="an-card">
        <div class="an-num" style="color:${mMean>=fMean?'#1a6fb5':'#e91e8c'}">${mMean.toFixed(1)} / ${fMean.toFixed(1)}</div>
        <div class="an-lbl">M / F Mean</div>
      </div>
    </div>
    <div class="dash-charts dash-charts-3" style="margin-top:1rem">
      <div class="chart-box chart-span2">
        <h3>📊 Subject Performance</h3>
        <canvas id="anSubChart" style="max-height:200px"></canvas>
      </div>
      <div class="chart-box">
        <h3>⚧ Gender Comparison</h3>
        <canvas id="anGenderChart" style="max-height:200px"></canvas>
      </div>
      ${streamPerf.length>1?`<div class="chart-box"><h3>🏫 Stream Comparison</h3><canvas id="anStreamChart" style="max-height:200px"></canvas></div>`:''}
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>📋 Subject Breakdown</h3>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Subject</th><th>Students</th><th>Mean</th><th>Highest</th><th>Lowest</th><th>Grade</th></tr></thead>
          <tbody>${subjectMeans.map(sm=>{
            const g=getGrade(sm.mn,100);
            return `<tr>
              <td><strong>${sm.sub.name}</strong> <span class="badge b-blue" style="font-size:.65rem">${sm.sub.code}</span></td>
              <td>${sm.count}</td>
              <td style="font-weight:700;color:var(--primary)">${sm.mn.toFixed(1)}</td>
              <td style="color:var(--success)">${sm.mx}</td>
              <td style="color:var(--danger)">${sm.lo}</td>
              <td>${gradeTag(g)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>🏆 Student Rankings</h3>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Rank</th><th>Student</th><th>Stream</th><th>Total</th><th>Mean</th><th>Grade</th></tr></thead>
          <tbody>${[...studentTotals].sort((a,b)=>b.total-a.total).slice(0,50).map((s,i)=>{
            const g=getMeanGrade(s.mean/totalSubjects*8);
            const str=streams.find(x=>x.id===s.streamId);
            return `<tr>
              <td style="font-weight:700;color:${i<3?'#d97706':'var(--text)'}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
              <td><strong>${s.name}</strong><br><span style="font-size:.72rem;color:var(--muted)">${s.adm}</span></td>
              <td>${str?.name||'—'}</td>
              <td style="font-weight:700">${s.total}</td>
              <td>${s.mean.toFixed(2)}</td>
              <td>${gradeTag(g)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;

  // Draw charts
  setTimeout(() => {
    try {
      const subCtx = document.getElementById('anSubChart');
      if (subCtx) {
        if (anCharts['sub']) anCharts['sub'].destroy();
        anCharts['sub'] = new Chart(subCtx, {
          type:'bar',
          data:{ labels: subjectMeans.map(s=>s.sub.code), datasets:[{ label:'Mean Score', data: subjectMeans.map(s=>parseFloat(s.mn.toFixed(1))), backgroundColor: subjectMeans.map((s,i)=>`hsla(${i*37+200},70%,55%,0.8)`), borderRadius:6 }] },
          options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, max:100} } }
        });
      }
    } catch(e) {}
    try {
      const genCtx = document.getElementById('anGenderChart');
      if (genCtx) {
        if (anCharts['gen']) anCharts['gen'].destroy();
        anCharts['gen'] = new Chart(genCtx, {
          type:'doughnut',
          data:{ labels:['Male','Female'], datasets:[{ data:[mMean.toFixed(1),fMean.toFixed(1)], backgroundColor:['#1a6fb5','#e91e8c'] }] },
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}}} }
        });
      }
    } catch(e) {}
    try {
      const strCtx = document.getElementById('anStreamChart');
      if (strCtx && streamPerf.length>1) {
        if (anCharts['str']) anCharts['str'].destroy();
        anCharts['str'] = new Chart(strCtx, {
          type:'bar',
          data:{ labels: streamPerf.map(s=>s.str.name), datasets:[{ label:'Stream Mean', data: streamPerf.map(s=>parseFloat(s.mn.toFixed(1))), backgroundColor:'rgba(26,111,181,0.7)', borderRadius:6 }] },
          options:{ responsive:true, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,max:100} } }
        });
      }
    } catch(e) {}
  }, 200);
}

// ══════════════════════════════════════════════════════════
//  SETTINGS → TEACHER PREFERENCES
// ══════════════════════════════════════════════════════════

function renderTeacherPreferences() {
  const isTeacher   = currentUser && currentUser.role === 'teacher';
  const isAdmin     = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
  const isSuperAdmin= currentUser && currentUser.role === 'superadmin';
  const prefCard    = document.getElementById('teacherPrefsCard');
  const adminCard   = document.getElementById('adminTeacherAccessCard');
  const restrictCard= document.getElementById('globalTeacherRestrictCard');
  const schoolCard  = document.querySelector('#s-settings .card');   // first card = school info

  // Show/hide panels by role
  if (prefCard)     prefCard.style.display     = isTeacher   ? '' : 'none';
  if (adminCard)    adminCard.style.display    = isAdmin     ? '' : 'none';
  if (restrictCard) restrictCard.style.display = isSuperAdmin? '' : 'none';

  // Teachers: hide admin-only cards (School Info, Admin Accounts, Data Management)
  const allCards = document.querySelectorAll('#s-settings .card');
  allCards.forEach(card => {
    const h3 = card.querySelector('h3');
    if (!h3) return;
    const adminOnlyTitles = ['🏫 School Information','🔐 Admin Accounts','💾 Data Management','📊 Grading Systems'];
    if (isTeacher && adminOnlyTitles.some(t => h3.textContent.includes(t.replace(/[🏫🔐💾📊]/g,'').trim()))) {
      card.style.display = 'none';
    } else if (!isTeacher) {
      card.style.display = '';
    }
  });

  if (isTeacher) renderMyPreferences();
  if (isAdmin)   renderAdminTeacherAccessPanel();
}

function renderMyPreferences() {
  const t = getCurrentTeacher();
  if (!t) return;

  // My Subjects
  const mySubIds = getMySubjectIds();
  const mySubsEl = document.getElementById('prefMySubjects');
  if (mySubsEl) {
    mySubsEl.innerHTML = mySubIds.length
      ? mySubIds.map(sid => {
          const s = subjects.find(x => x.id === sid);
          return s ? `<span class="badge b-blue" style="font-size:.78rem;padding:.25rem .6rem">${s.name} <span style="opacity:.7;font-size:.7rem">${s.code}</span></span>` : '';
        }).join('')
      : '<span style="color:var(--muted);font-size:.82rem">No subjects assigned yet. Contact your admin.</span>';
  }

  // My Class
  const myStreams  = getMyClassTeacherStreams();
  const myClassEl  = document.getElementById('prefMyClass');
  if (myClassEl) {
    if (myStreams.length) {
      myClassEl.innerHTML = myStreams.map(str => {
        const cls = classes.find(c => c.id === str.classId);
        return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
          <span class="badge b-green" style="font-size:.78rem">🏫 ${cls?.name||'—'} — ${str.name}</span>
          <span style="font-size:.75rem;color:var(--muted)">Class Teacher</span>
        </div>`;
      }).join('');
    } else {
      myClassEl.innerHTML = '<span style="color:var(--muted);font-size:.82rem">You are not a class teacher for any stream.</span>';
    }
  }

  // My Rights
  const rightsEl = document.getElementById('prefMyRights');
  if (rightsEl) {
    const rights = [
      { key: 'canAnalyse', label: 'Run Exam Analysis', icon: '📊', desc: 'View and run detailed exam analysis reports' },
      { key: 'canReport',  label: 'Generate Report Forms', icon: '📄', desc: 'Generate and print student report cards' },
      { key: 'canMerit',   label: 'View Merit List', icon: '🏆', desc: 'Access the class merit/ranking list' },
    ];
    rightsEl.innerHTML = rights.map(r => `
      <div style="display:flex;align-items:center;gap:.6rem;padding:.4rem .6rem;border-radius:6px;background:var(--surface);border:1px solid var(--border)">
        <span style="font-size:1rem">${r.icon}</span>
        <div style="flex:1">
          <div style="font-size:.82rem;font-weight:600">${r.label}</div>
          <div style="font-size:.72rem;color:var(--muted)">${r.desc}</div>
        </div>
        <span class="${t[r.key] ? 'badge b-green' : 'badge b-red'}" style="font-size:.7rem">${t[r.key] ? '✅ Granted' : '✗ Restricted'}</span>
      </div>`).join('');
  }
}

function saveTeacherPassword() {
  const t   = getCurrentTeacher(); if (!t) return;
  const cur = document.getElementById('prefCurPass')?.value;
  const nw  = document.getElementById('prefNewPass')?.value;
  const cf  = document.getElementById('prefConfPass')?.value;
  if (!cur || !nw || !cf) { showToast('All password fields are required', 'error'); return; }
  if (t.password !== cur)  { showToast('Current password is incorrect', 'error'); return; }
  if (nw !== cf)           { showToast('New passwords do not match', 'error'); return; }
  if (nw.length < 4)       { showToast('Password must be at least 4 characters', 'error'); return; }
  const i = teachers.findIndex(x => x.id === t.id);
  if (i > -1) { teachers[i].password = nw; save(K.teachers, teachers); }
  ['prefCurPass','prefNewPass','prefConfPass'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  showToast('Password updated ✓', 'success');
}

// ── Admin: Teacher Access Manager in Settings ──
function renderAdminTeacherAccessPanel() {
  const tamTeacher = document.getElementById('tamTeacher');
  if (!tamTeacher) return;
  tamTeacher.innerHTML = '<option value="">— Choose a teacher —</option>' +
    teachers.map(t => `<option value="${t.id}">${t.name} (${t.username||'no login'})</option>`).join('');
}

function renderTeacherAccessManager() {
  const teacherId = document.getElementById('tamTeacher')?.value;
  const content   = document.getElementById('tamContent');
  if (!teacherId) { if (content) content.style.display='none'; return; }
  if (content) content.style.display = '';
  const t = teachers.find(x => x.id === teacherId); if (!t) return;

  // Subjects: show read-only from Stream Management (not editable here)
  const subsEl = document.getElementById('tamSubjects');
  if (subsEl) {
    const mySubIds = getTeacherSubjectIds(teacherId);
    if (mySubIds.length) {
      subsEl.innerHTML = mySubIds.map(sid => {
        const s = subjects.find(x => x.id === sid);
        if (!s) return '';
        return `<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem .5rem;border-radius:5px;border:1px solid var(--border);background:var(--surface)">
          <span class="badge b-blue" style="font-size:.72rem">${s.code}</span>
          <span style="font-size:.82rem;font-weight:600">${s.name}</span>
        </div>`;
      }).join('');
    } else {
      subsEl.innerHTML = '<p style="font-size:.8rem;color:var(--muted)">No subjects assigned yet. Use <strong>Stream Management</strong> to assign subjects to this teacher.</p>';
    }
  }

  // Rights
  const rightsEl = document.getElementById('tamRights');
  if (rightsEl) {
    rightsEl.innerHTML = [
      { id:'tam-canAnalyse', key:'canAnalyse', label:'Can run exam analysis' },
      { id:'tam-canReport',  key:'canReport',  label:'Can generate report forms' },
      { id:'tam-canMerit',   key:'canMerit',   label:'Can view merit list' },
    ].map(r => `
      <label class="check-label" style="font-size:.84rem">
        <input type="checkbox" id="${r.id}" ${t[r.key]?'checked':''}/> ${r.label}
      </label>`).join('');
  }

  // Scope: class teacher assignment
  const scopeEl = document.getElementById('tamScope');
  if (scopeEl) {
    const myStreams = streams.filter(s => s.streamTeacherId === teacherId);
    scopeEl.innerHTML = streams.map(str => {
      const cls = classes.find(c => c.id === str.classId);
      return `
        <label class="check-label" style="font-size:.82rem">
          <input type="checkbox" class="tam-stream-chk" data-streamid="${str.id}" ${myStreams.some(s=>s.id===str.id)?'checked':''}/>
          Class Teacher of <strong>${cls?.name||'?'} — ${str.name}</strong>
        </label>`;
    }).join('') || '<span style="color:var(--muted);font-size:.82rem">No streams defined.</span>';
  }
}

function saveTeacherAccessSettings() {
  const teacherId = document.getElementById('tamTeacher')?.value;
  if (!teacherId) { showToast('Select a teacher first', 'error'); return; }
  const t = teachers.find(x => x.id === teacherId); if (!t) return;

  // Save rights
  t.canAnalyse = !!document.getElementById('tam-canAnalyse')?.checked;
  t.canReport  = !!document.getElementById('tam-canReport')?.checked;
  t.canMerit   = !!document.getElementById('tam-canMerit')?.checked;

  // Note: Subject assignments are managed via Stream Management — not here

  // Save stream (class teacher) assignments
  const checkedStreamIds = [...document.querySelectorAll('.tam-stream-chk:checked')].map(el => el.dataset.streamid);
  streams.forEach(str => {
    if (checkedStreamIds.includes(str.id)) {
      str.streamTeacherId = teacherId;
    } else if (str.streamTeacherId === teacherId) {
      str.streamTeacherId = '';
    }
  });

  save(K.teachers, teachers);
  save(K.subjects, subjects);
  save(K.streams, streams);
  saveStreamAssignments();
  renderTeachers(); renderSubjects(); renderStreams();
  showToast(`Access settings saved for ${t.name} ✓`, 'success');
}

// Hook: call renderTeacherPreferences when navigating to Settings

// ═══════════════ SCHOOL MANAGEMENT (from Settings) ═══════════════
function renderSettingsSchoolList() {
  const el = document.getElementById('settingsSchoolList');
  if (!el) return;
  loadPlatform();
  if (!platformSchools.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:.5rem 0">No school accounts yet.</p>'; return;
  }
  el.innerHTML = platformSchools.map(s => `
    <div class="admin-item">
      <div>
        <div class="ai-name">${s.name}</div>
        <div class="ai-role">${s.username}${s.email?' · '+s.email:''} · <span class="badge b-blue" style="font-size:.65rem">School</span></div>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="btn btn-outline btn-sm" style="font-size:.72rem;padding:.2rem .55rem" onclick="resetSchoolPwd('${s.id}')">🔑 Reset Pwd</button>
        <button class="icb dl" onclick="deleteSchoolFromSettings('${s.id}')" title="Delete">🗑️</button>
      </div>
    </div>`).join('');
}

function addSchoolFromSettings() {
  const name  = document.getElementById('spsName').value.trim();
  const user  = document.getElementById('spsUser').value.trim();
  const pass  = document.getElementById('spsPass').value;
  const email = document.getElementById('spsEmail').value.trim();
  if (!name||!user||!pass) { showToast('Name, username and password required','error'); return; }
  loadPlatform();
  if (platformSchools.find(s=>s.username===user)) { showToast('Username already taken','error'); return; }
  platformSchools.push({ id:'sch_'+uid(), name, username:user, password:pass, email, createdAt:new Date().toISOString() });
  savePlatform();
  ['spsName','spsUser','spsPass','spsEmail'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  renderSettingsSchoolList();
  showToast('School account created ✓','success');
}

function deleteSchoolFromSettings(id) {
  if (!confirm('Delete this school? All its data will be permanently removed.')) return;
  loadPlatform();
  Object.keys(localStorage).filter(k=>k.startsWith(id+'_')).forEach(k=>localStorage.removeItem(k));
  platformSchools = platformSchools.filter(s=>s.id!==id);
  savePlatform(); renderSettingsSchoolList();
  showToast('School deleted','info');
}

function resetSchoolPwd(id) {
  const np = prompt('Enter new password for this school account (min 4 chars):');
  if (!np||np.trim().length<4) { if(np!==null) showToast('Password too short','error'); return; }
  loadPlatform();
  const s = platformSchools.find(x=>x.id===id);
  if (s) { s.password = np.trim(); savePlatform(); showToast('Password updated ✓','success'); }
}

function changePlatformPassword() {
  const cur  = document.getElementById('curPlatformPwd').value;
  const nw   = document.getElementById('newPlatformPwd').value;
  const conf = document.getElementById('confPlatformPwd').value;
  const creds = getPlatformCreds();
  if (!creds || cur !== creds.password) { showToast('Current password is incorrect','error'); return; }
  if (!nw || nw.length < 6) { showToast('New password must be at least 6 characters','error'); return; }
  if (nw !== conf) { showToast('Passwords do not match','error'); return; }
  setPlatformCreds(creds.username, nw);
  ['curPlatformPwd','newPlatformPwd','confPlatformPwd'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  showToast('Platform password changed ✓','success');
}


// ═══════════════════════════════════════════════════════════════════
//  PAPERS & RESOURCES  –  Termly Exams + Revision
// ═══════════════════════════════════════════════════════════════════

// ── Storage key ──
const K_PAPERS = { get termly() { return schoolPrefix() + 'ei_termly_papers'; } };

let termlyPapers = [];

function loadTermlyPapers()  { try { termlyPapers = JSON.parse(localStorage.getItem(K_PAPERS.termly)) || []; } catch { termlyPapers = []; } }
function saveTermlyPapers()  { localStorage.setItem(K_PAPERS.termly, JSON.stringify(termlyPapers)); }

// ── Tab switcher ──
function openPapersTab(tabId, btn) {
  document.querySelectorAll('#s-papers .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#papersTabBar .tb').forEach(b => b.classList.remove('active'));
  const p = document.getElementById(tabId); if (p) p.classList.add('active');
  if (btn) btn.classList.add('active');
  if (tabId === 'tabTermlyExams') initTermlyExamsTab();
}

// ── Init when section is entered ──
function initPapersSection() {
  loadTermlyPapers();
  initTermlyExamsTab();
}

function initTermlyExamsTab() {
  populateTermlySubjectDropdowns();
  populateTermlyYearFilter();
  renderTermlyPapers();
  // Show/hide upload card based on role
  const isAdmin = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');
  const uploadCard = document.getElementById('termlyUploadCard');
  if (uploadCard) uploadCard.style.display = isAdmin ? '' : 'none';
}

// ── Populate subject dropdowns ──
function populateTermlySubjectDropdowns() {
  const sel   = document.getElementById('tpSubject');
  const fSel  = document.getElementById('tpFilterSubject');
  if (!sel || !fSel) return;
  const opts = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  sel.innerHTML  = '<option value="">— Select Subject —</option>' + opts;
  fSel.innerHTML = '<option value="">All Subjects</option>' + opts;
}

// ── Populate year filter from existing papers ──
function populateTermlyYearFilter() {
  const sel = document.getElementById('tpFilterYear');
  if (!sel) return;
  const years = [...new Set(termlyPapers.map(p => p.year))].sort((a,b) => b-a);
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option ${y==cur?'selected':''}>${y}</option>`).join('');
}

// ── Upload a paper ──
function uploadTermlyPaper() {
  const subjectId = document.getElementById('tpSubject').value.trim();
  const term      = document.getElementById('tpTerm').value;
  const year      = parseInt(document.getElementById('tpYear').value);
  const title     = document.getElementById('tpTitle').value.trim();
  const classLvl  = document.getElementById('tpClass').value.trim();
  const price     = parseFloat(document.getElementById('tpPrice').value);
  const desc      = document.getElementById('tpDesc').value.trim();
  const fileInput = document.getElementById('tpFile');
  const file      = fileInput.files[0];

  if (!subjectId) { showToast('Please select a subject','error'); return; }
  if (!title)     { showToast('Please enter a paper title','error'); return; }
  if (isNaN(year) || year < 2000) { showToast('Enter a valid year','error'); return; }
  if (isNaN(price) || price < 0) { showToast('Enter a valid price (0 for free)','error'); return; }
  if (!file)      { showToast('Please select a file to upload','error'); return; }

  const MAX_FILE_MB = 5;
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showToast(`File too large. Maximum size is ${MAX_FILE_MB}MB`, 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const paper = {
      id:        uid(),
      subjectId,
      term,
      year,
      title,
      classLvl,
      price,
      desc,
      fileName:  file.name,
      fileType:  file.type,
      fileData:  e.target.result,   // base64 data URL
      uploadedBy: currentUser ? currentUser.name : 'Admin',
      uploadedAt: new Date().toISOString(),
      downloads:  0,
    };
    loadTermlyPapers();
    termlyPapers.push(paper);
    saveTermlyPapers();

    // Reset form
    ['tpSubject','tpTerm','tpTitle','tpClass','tpPrice','tpDesc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; }
    });
    document.getElementById('tpYear').value = new Date().getFullYear();
    fileInput.value = '';

    populateTermlyYearFilter();
    renderTermlyPapers();
    showToast('Paper uploaded successfully ✓', 'success');
  };
  reader.onerror = () => showToast('Failed to read file. Please try again.', 'error');
  reader.readAsDataURL(file);
}

// ── Render papers grouped by subject ──
function renderTermlyPapers() {
  loadTermlyPapers();
  const grid  = document.getElementById('termlyPapersGrid');
  const empty = document.getElementById('termlyPapersEmpty');
  if (!grid) return;

  const filterSubject = document.getElementById('tpFilterSubject')?.value || '';
  const filterTerm    = document.getElementById('tpFilterTerm')?.value || '';
  const filterYear    = document.getElementById('tpFilterYear')?.value || '';
  const search        = (document.getElementById('tpSearch')?.value || '').toLowerCase();

  let list = [...termlyPapers];
  if (filterSubject) list = list.filter(p => p.subjectId === filterSubject);
  if (filterTerm)    list = list.filter(p => p.term === filterTerm);
  if (filterYear)    list = list.filter(p => String(p.year) === String(filterYear));
  if (search)        list = list.filter(p => {
    const subj = subjects.find(s => s.id === p.subjectId);
    return (subj?.name||'').toLowerCase().includes(search) ||
           p.title.toLowerCase().includes(search) ||
           (p.classLvl||'').toLowerCase().includes(search) ||
           (p.desc||'').toLowerCase().includes(search);
  });

  // Sort papers newest first
  list.sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  const isAdmin = currentUser && (currentUser.role === 'superadmin' || currentUser.role === 'admin');

  if (!list.length) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    empty.style.display = '';
    return;
  }
  grid.style.display = 'block';
  empty.style.display = 'none';

  // ── Group by subject ──
  const grouped = {};
  list.forEach(p => {
    const subj = subjects.find(s => s.id === p.subjectId);
    const key  = p.subjectId || '__unknown__';
    if (!grouped[key]) grouped[key] = { subj, papers: [] };
    grouped[key].papers.push(p);
  });

  // Sort groups by subject name
  const sortedGroups = Object.values(grouped).sort((a,b) => {
    const na = a.subj ? a.subj.name.toLowerCase() : 'zzz';
    const nb = b.subj ? b.subj.name.toLowerCase() : 'zzz';
    return na < nb ? -1 : na > nb ? 1 : 0;
  });

  grid.innerHTML = sortedGroups.map(group => {
    const subjName = group.subj ? group.subj.name : 'Unknown Subject';
    const count    = group.papers.length;

    const paperRows = group.papers.map(p => {
      const isFree     = p.price === 0;
      const priceLabel = isFree
        ? '<span style="color:#16a34a;font-weight:700;font-size:.85rem">FREE</span>'
        : `<span style="color:var(--primary);font-weight:700;font-size:.85rem">KES ${p.price.toLocaleString()}</span>`;
      const fileIcon   = getFileIcon(p.fileType, p.fileName);
      const uploadDate = new Date(p.uploadedAt).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'});

      return `
      <div style="display:flex;align-items:flex-start;gap:1rem;padding:.9rem 1rem;border-bottom:1px solid var(--border-lt);flex-wrap:wrap">
        <!-- File icon -->
        <div style="font-size:1.6rem;flex-shrink:0;line-height:1.2;padding-top:.1rem">${fileIcon}</div>

        <!-- Info -->
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.92rem;margin-bottom:.15rem;word-break:break-word">${p.title}</div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;font-size:.75rem;color:var(--muted);margin-bottom:.2rem">
            <span>📅 ${uploadDate}</span>
            <span>·</span>
            <span>${p.term} ${p.year}</span>
            ${p.classLvl ? `<span>·</span><span>📚 ${p.classLvl}</span>` : ''}
            <span>·</span>
            <span>⬇️ ${p.downloads} download${p.downloads !== 1 ? 's' : ''}</span>
          </div>
          ${p.desc ? `<div style="font-size:.78rem;color:var(--muted);line-height:1.4">${p.desc}</div>` : ''}
        </div>

        <!-- Price + actions -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;flex-shrink:0">
          <div>${priceLabel}</div>
          <div style="display:flex;gap:.4rem">
            <button class="btn btn-sm btn-primary" onclick="downloadTermlyPaper('${p.id}')">
              ${isFree ? '⬇️ Download' : '💳 Buy & Download'}
            </button>
            ${isAdmin ? `<button class="btn btn-sm" style="background:var(--danger-lt,#fee2e2);color:#dc2626;border:none" onclick="deleteTermlyPaper('${p.id}')">🗑</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:1rem">
      <!-- Subject header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:var(--primary-lt,#eff6ff);border-bottom:2px solid var(--primary,#1a6fb5)">
        <div style="display:flex;align-items:center;gap:.6rem">
          <span style="font-size:1.1rem">📘</span>
          <span style="font-weight:800;font-size:1rem;color:var(--primary,#1a6fb5)">${subjName}</span>
        </div>
        <span style="background:var(--primary,#1a6fb5);color:#fff;font-size:.72rem;font-weight:700;padding:.2rem .6rem;border-radius:999px">${count} paper${count !== 1 ? 's' : ''}</span>
      </div>
      <!-- Paper rows -->
      ${paperRows}
    </div>`;
  }).join('');
}

// ── Get file icon by type ──
function getFileIcon(fileType, fileName) {
  if (!fileType && fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
    if (['doc','docx'].includes(ext)) return '📝';
    return '📄';
  }
  if (fileType.includes('pdf'))   return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('image')) return '🖼️';
  return '📁';
}

// ── Download / buy a paper ──
function downloadTermlyPaper(paperId) {
  loadTermlyPapers();
  const paper = termlyPapers.find(p => p.id === paperId);
  if (!paper) { showToast('Paper not found', 'error'); return; }

  if (paper.price > 0) {
    // Show payment confirmation modal
    const subj = subjects.find(s => s.id === paper.subjectId);
    showModal(
      '💳 Purchase Paper',
      `
      <div style="text-align:center;padding:1rem 0">
        <div style="font-size:2.5rem;margin-bottom:.75rem">${getFileIcon(paper.fileType, paper.fileName)}</div>
        <div style="font-weight:700;font-size:1.05rem;margin-bottom:.25rem">${paper.title}</div>
        <div style="color:var(--muted);font-size:.85rem;margin-bottom:1.25rem">${subj ? subj.name : ''} · ${paper.term} ${paper.year}</div>
        <div style="background:var(--primary-lt);border-radius:12px;padding:1rem;margin-bottom:1.25rem">
          <div style="font-size:.8rem;color:var(--muted);margin-bottom:.2rem">Amount to Pay</div>
          <div style="font-size:2rem;font-weight:800;color:var(--primary)">KES ${paper.price.toLocaleString()}</div>
        </div>
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:1rem">
          Pay via M-Pesa or school cashier, then click <strong>Confirm &amp; Download</strong>.
        </p>
        <button class="btn btn-primary" style="width:100%;margin-bottom:.5rem" onclick="confirmPaperDownload('${paperId}');closeModal()">
          ✅ Confirm &amp; Download
        </button>
        <button class="btn" style="width:100%" onclick="closeModal()">Cancel</button>
      </div>`,
      []
    );
  } else {
    confirmPaperDownload(paperId);
  }
}

// ── Actually trigger the download ──
function confirmPaperDownload(paperId) {
  loadTermlyPapers();
  const idx = termlyPapers.findIndex(p => p.id === paperId);
  if (idx === -1) { showToast('Paper not found', 'error'); return; }
  const paper = termlyPapers[idx];

  // Increment download count
  termlyPapers[idx].downloads = (paper.downloads || 0) + 1;
  saveTermlyPapers();
  renderTermlyPapers();

  // Trigger file download
  try {
    const link = document.createElement('a');
    link.href = paper.fileData;
    link.download = paper.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Downloading: ${paper.fileName} ✓`, 'success');
  } catch(e) {
    showToast('Download failed. Please try again.', 'error');
  }
}

// ── Delete a paper (admin only) ──
function deleteTermlyPaper(paperId) {
  if (!confirm('Delete this paper? This action cannot be undone.')) return;
  loadTermlyPapers();
  termlyPapers = termlyPapers.filter(p => p.id !== paperId);
  saveTermlyPapers();
  populateTermlyYearFilter();
  renderTermlyPapers();
  showToast('Paper deleted', 'success');
}


/* ═══════════════════════════════════════════════════════════════════════════════
   EXAM BUILDER MODULE — Integrated into Charanas Analyser
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─── Storage key ────────────────────────────────────────────────────────────────
const EB_KEY = () => schoolPrefix() + 'eb_exams';

function ebLoad() { try { return JSON.parse(localStorage.getItem(EB_KEY())) || []; } catch { return []; } }
function ebSave(arr) { localStorage.setItem(EB_KEY(), JSON.stringify(arr)); }
function ebGenId() { return 'eb_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
function ebEscape(s) { if(!s)return''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── State ───────────────────────────────────────────────────────────────────
const EB = {
  currentStep: 1,
  sections: [],
  editingId: null,
  aiDiff: 'easy',
  modalDiff: 'medium',
  gaDiff: 'medium',
  aiSectionIdx: null,
  mathTarget: null,
  subPartsSec: null,
  subPartsQ: null,
  genAiResults: [],
  spColors: ['#1a6fb5','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']
};

// ─── Tab Navigation ──────────────────────────────────────────────────────────
function openEBTab(id, btn) {
  document.querySelectorAll('#s-exambuilder .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#ebTabBar .tb').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById(id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'tabEBSaved') { ebRenderSavedExams(); ebPopulateMsSelect(); }
  if (id === 'tabEBMarking') ebPopulateMsSelect();
}

// ─── Wizard Navigation ───────────────────────────────────────────────────────
function ebGoToStep(step) {
  if (step > EB.currentStep) {
    if (EB.currentStep === 1 && !ebValidateStep1()) return;
    if (EB.currentStep === 2 && !ebValidateStep2()) return;
  }
  EB.currentStep = step;
  document.querySelectorAll('.eb-wizard-content').forEach(c => c.classList.remove('active'));
  document.getElementById('eb-step-' + step)?.classList.add('active');
  document.querySelectorAll('.eb-step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active','completed');
    if (n === step) s.classList.add('active');
    else if (n < step) s.classList.add('completed');
  });
  if (step === 3) ebRenderQuestionBuilder();
  if (step === 4) { ebSyncDOM(); ebRenderPreview(); }
  // Setup header preview listeners on first visit to step 1
  if (step === 1) ebSetupHeaderPreview();
}

function ebValidateStep1() {
  const s = document.getElementById('eb-schoolName')?.value?.trim();
  const sub = document.getElementById('eb-subject')?.value?.trim();
  const cls = document.getElementById('eb-classLevel')?.value?.trim();
  if (!s) { showToast('Please enter school name', 'error'); return false; }
  if (!sub) { showToast('Please enter subject', 'error'); return false; }
  if (!cls) { showToast('Please enter class', 'error'); return false; }
  return true;
}
function ebValidateStep2() {
  if (!EB.sections.length) { showToast('Add at least one section', 'error'); return false; }
  return true;
}

// ─── Header Preview ──────────────────────────────────────────────────────────
function ebSetupHeaderPreview() {
  ['eb-schoolName','eb-subject','eb-classLevel','eb-examType','eb-duration','eb-examDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el._ebPreviewBound) {
      el.addEventListener('input', ebUpdatePreview);
      el.addEventListener('change', ebUpdatePreview);
      el._ebPreviewBound = true;
    }
  });
}
function ebUpdatePreview() {
  const get = id => document.getElementById(id)?.value || '';
  document.getElementById('eb-prev-school').textContent = (get('eb-schoolName') || 'SCHOOL NAME').toUpperCase();
  document.getElementById('eb-prev-subject').textContent = `${(get('eb-subject') || 'SUBJECT').toUpperCase()} – ${(get('eb-classLevel') || 'CLASS').toUpperCase()}`;
  document.getElementById('eb-prev-type').textContent = (get('eb-examType') || 'EXAM TYPE').toUpperCase();
  document.getElementById('eb-prev-meta').textContent = `TIME: ${get('eb-duration') || '—'} | DATE: ${get('eb-examDate') || '—'}`;
}

// ─── Instructions ────────────────────────────────────────────────────────────
function ebAddInstruction(text = '') {
  const list = document.getElementById('ebInstructionsList');
  const div = document.createElement('div');
  div.className = 'eb-inst-item';
  div.innerHTML = `<input type="text" value="${ebEscape(text)}" placeholder="Add instruction..." class="eb-inst-input"/>
    <button class="btn btn-sm" style="padding:3px 8px;color:var(--danger)" onclick="this.closest('.eb-inst-item').remove()">✕</button>`;
  list.appendChild(div);
}
function ebAutoInstructions() {
  const list = document.getElementById('ebInstructionsList');
  list.innerHTML = '';
  const insts = ['Write your name and admission number on the answer sheet.',
    'This paper consists of multiple sections. Read instructions for each section carefully.',
    'All working must be shown where applicable.',
    'Mobile phones and any unauthorized materials are not allowed in the examination room.',
    'Cheating will result in immediate disqualification.'];
  if (EB.sections.some(s => s.type === 'mcq')) insts.splice(1,0,'For multiple choice, shade or circle the correct answer.');
  if (EB.sections.some(s => s.type === 'structured')) insts.splice(2,0,'Answer all structured questions in the spaces provided.');
  if (EB.sections.some(s => s.type === 'essay')) insts.splice(3,0,'For essay questions, write in complete sentences and paragraphs.');
  insts.forEach(t => ebAddInstruction(t));
}
function ebGetInstructions() {
  return Array.from(document.querySelectorAll('#ebInstructionsList .eb-inst-input'))
    .map(i => i.value.trim()).filter(Boolean);
}

// ─── Sections ────────────────────────────────────────────────────────────────
function ebInitSections() {
  EB.sections = [
    { id:'sec_a', name:'A', type:'mcq', questionCount:10, marksPerQuestion:2, totalMarks:20, instruction:'Choose the best answer for each question.', questions:[] },
    { id:'sec_b', name:'B', type:'structured', questionCount:5, marksPerQuestion:6, totalMarks:30, instruction:'Answer all questions in the spaces provided.', questions:[] },
    { id:'sec_c', name:'C', type:'essay', questionCount:2, marksPerQuestion:25, totalMarks:50, instruction:'Answer any two questions from this section.', questions:[] }
  ];
}
function ebAddSection() {
  const names = ['A','B','C','D','E','F'];
  const used = EB.sections.map(s => s.name);
  const next = names.find(n => !used.includes(n)) || String(EB.sections.length + 1);
  EB.sections.push({ id:'sec_'+ebGenId(), name:next, type:'mcq', questionCount:5, marksPerQuestion:2, totalMarks:10, instruction:'', questions:[] });
  ebRenderSections();
}
function ebRemoveSection(idx) {
  if (EB.sections.length <= 1) { showToast('Need at least one section', 'error'); return; }
  EB.sections.splice(idx,1); ebRenderSections();
}
function ebUpdateSection(idx, key, value) {
  EB.sections[idx][key] = value;
  if (key === 'questionCount' || key === 'marksPerQuestion') {
    EB.sections[idx].totalMarks = (EB.sections[idx].questionCount || 0) * (EB.sections[idx].marksPerQuestion || 0);
  }
  ebRenderSections();
}
function ebUpdateSectionName(idx, value) {
  EB.sections[idx].name = value.replace('Section ','').trim() || String.fromCharCode(65 + idx);
}
function ebRenderSections() {
  const c = document.getElementById('ebSectionsList');
  if (!c) return;
  if (!EB.sections.length) { c.innerHTML = '<p style="color:var(--muted);text-align:center;padding:1.5rem">No sections. Click Add Section.</p>'; ebUpdateTotalMarks(); return; }
  c.innerHTML = EB.sections.map((sec, idx) => `
    <div class="eb-section-card" id="ebsc-${idx}">
      <div class="eb-section-hd">
        <div class="eb-section-color" style="background:${EB.spColors[idx % EB.spColors.length]}"></div>
        <input class="eb-section-title-inp" value="Section ${ebEscape(sec.name)}" onchange="ebUpdateSectionName(${idx},this.value)" placeholder="Section name..."/>
        <span style="margin-left:auto;font-size:.76rem;background:var(--primary-lt);color:var(--primary);padding:2px 8px;border-radius:20px;font-weight:700">${sec.questions.length} Qs</span>
        <button onclick="ebRemoveSection(${idx})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:1rem;margin-left:.25rem" title="Remove">✕</button>
      </div>
      <div class="eb-section-body">
        <div class="eb-section-field"><label>Type</label>
          <select onchange="ebUpdateSection(${idx},'type',this.value)">
            <option value="mcq" ${sec.type==='mcq'?'selected':''}>Multiple Choice</option>
            <option value="structured" ${sec.type==='structured'?'selected':''}>Structured</option>
            <option value="essay" ${sec.type==='essay'?'selected':''}>Essay</option>
          </select>
        </div>
        <div class="eb-section-field"><label>Questions</label><input type="number" value="${sec.questionCount}" min="1" max="50" onchange="ebUpdateSection(${idx},'questionCount',parseInt(this.value))"/></div>
        <div class="eb-section-field"><label>Marks Each</label><input type="number" value="${sec.marksPerQuestion}" min="1" max="100" onchange="ebUpdateSection(${idx},'marksPerQuestion',parseInt(this.value))"/></div>
        <div class="eb-section-field"><label>Section Total</label><input type="number" value="${sec.totalMarks}" min="1" max="200" style="background:var(--primary-lt);font-weight:700" onchange="ebUpdateSection(${idx},'totalMarks',parseInt(this.value))"/></div>
      </div>
      <div style="padding:.5rem 1rem .75rem">
        <input type="text" value="${ebEscape(sec.instruction||'')}" placeholder="Section instruction..." onchange="ebUpdateSection(${idx},'instruction',this.value)"
          style="width:100%;padding:6px 10px;border:1.5px solid var(--border-lt);border-radius:6px;font-size:.82rem;outline:none"/>
      </div>
    </div>`).join('');
  ebUpdateTotalMarks();
}
function ebUpdateTotalMarks() {
  const t = EB.sections.reduce((s,sec) => s + (sec.totalMarks||0), 0);
  const el = document.getElementById('ebTotalMarks');
  if (el) el.textContent = t;
}

// ─── Question Builder ─────────────────────────────────────────────────────────
function ebRenderQuestionBuilder() {
  const area = document.getElementById('ebQuestionBuilderArea');
  if (!area) return;
  const banner = document.getElementById('ebGenerateAllBanner');
  if (banner) banner.style.display = EB.sections.length > 0 ? 'flex' : 'none';
  if (!EB.sections.length) {
    area.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)"><div style="font-size:2rem">📂</div><p>No sections defined.</p></div>';
    return;
  }
  const letters = ['A','B','C','D'];
  area.innerHTML = EB.sections.map((sec, sIdx) => `
    <div class="card" style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;border-bottom:1px solid var(--border-lt);background:${EB.spColors[sIdx%EB.spColors.length]}12;border-left:4px solid ${EB.spColors[sIdx%EB.spColors.length]}">
        <h3 style="font-size:.95rem;color:${EB.spColors[sIdx%EB.spColors.length]}">Section ${ebEscape(sec.name)}: ${ebTypeLabel(sec.type)} <span style="font-size:.76rem;background:${EB.spColors[sIdx%EB.spColors.length]}22;padding:1px 8px;border-radius:20px;margin-left:.35rem">${sec.questions.length}/${sec.questionCount}</span></h3>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-outline btn-sm" onclick="ebOpenAIModal(${sIdx})">🤖 AI</button>
          <button class="btn btn-outline btn-sm" onclick="ebAddQuestion(${sIdx})">➕ Manual</button>
        </div>
      </div>
      <div style="padding:.75rem 1rem" id="ebqs-${sIdx}">
        ${!sec.questions.length ? `<p style="color:var(--muted);font-size:.82rem;text-align:center;padding:1rem">No questions yet — click AI or Manual to add</p>` :
          sec.type === 'mcq'
            ? `<div class="eb-mcq-grid">${sec.questions.map((q,qIdx) => ebRenderQCard(sIdx,qIdx,q,sec)).join('')}</div>`
            : sec.questions.map((q,qIdx) => ebRenderQCard(sIdx,qIdx,q,sec)).join('')
        }
      </div>
    </div>`).join('');
}

function ebTypeLabel(t) { return {mcq:'Multiple Choice',structured:'Structured',essay:'Essay'}[t] || t; }

function ebRenderQCard(sIdx, qIdx, q, sec) {
  const letters = ['A','B','C','D'];
  const badge = q.aiGenerated ? '<span style="font-size:.68rem;background:#d1fae5;color:#065f46;padding:1px 6px;border-radius:12px;font-weight:700">AI</span>' : '';
  const typeLabel = {mcq:'MCQ',structured:'STR',essay:'ESS'}[sec.type] || sec.type;
  let body = '';
  if (sec.type === 'mcq') {
    body = `
      <textarea class="eb-qtextarea" id="ebqt-${sIdx}-${qIdx}" placeholder="Question text..." onchange="ebUpdateQ(${sIdx},${qIdx},'question',this.value)">${ebEscape(q.question||'')}</textarea>
      <div class="eb-qmeta">
        <label>Marks:</label><input type="number" value="${q.marks||2}" min="1" max="50" onchange="ebUpdateQ(${sIdx},${qIdx},'marks',parseInt(this.value))"/>
        <label>Correct:</label>
        <select onchange="ebUpdateQ(${sIdx},${qIdx},'answer',this.value)">
          ${letters.map(l => `<option value="${l}" ${q.answer===l?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div style="margin-top:.5rem">
        ${(q.options&&q.options.length?q.options:['','','','']).map((opt,oi) => `
          <div class="eb-mcq-option">
            <div class="eb-opt-lbl" style="${q.answer===letters[oi]?'background:var(--primary);color:#fff':''}">${letters[oi]}</div>
            <input type="text" value="${ebEscape(opt)}" placeholder="Option ${letters[oi]}..." onchange="ebUpdateOpt(${sIdx},${qIdx},${oi},this.value)"/>
            <input type="radio" name="ebcorr-${sIdx}-${qIdx}" ${q.answer===letters[oi]?'checked':''} onchange="ebUpdateQ(${sIdx},${qIdx},'answer','${letters[oi]}')" style="cursor:pointer;accent-color:var(--primary)"/>
          </div>`).join('')}
      </div>`;
  } else if (sec.type === 'structured') {
    body = `
      <textarea class="eb-qtextarea" id="ebqt-${sIdx}-${qIdx}" placeholder="Question text..." onchange="ebUpdateQ(${sIdx},${qIdx},'question',this.value)">${ebEscape(q.question||'')}</textarea>
      <div class="eb-qmeta">
        <label>Marks:</label><input type="number" value="${q.marks||6}" min="1" max="100" onchange="ebUpdateQ(${sIdx},${qIdx},'marks',parseInt(this.value))"/>
        <button class="btn btn-outline btn-sm" onclick="ebOpenSubParts(${sIdx},${qIdx})" style="font-size:.76rem">≡ Sub-parts ${q.subParts?.length?`(${q.subParts.length})`:''}</button>
      </div>
      ${q.subParts?.length ? `<div style="margin-top:.4rem;font-size:.76rem;color:var(--muted);padding:4px 8px;background:var(--bg);border-radius:5px">Sub-parts: ${q.subParts.map((p,i) => `(${String.fromCharCode(97+i)}) ${p.text.substring(0,25)}…`).join(' | ')}</div>` : ''}`;
  } else {
    body = `
      <textarea class="eb-qtextarea" id="ebqt-${sIdx}-${qIdx}" placeholder="Essay question..." onchange="ebUpdateQ(${sIdx},${qIdx},'question',this.value)">${ebEscape(q.question||'')}</textarea>
      <div class="eb-qmeta">
        <label>Marks:</label><input type="number" value="${q.marks||25}" min="1" max="100" onchange="ebUpdateQ(${sIdx},${qIdx},'marks',parseInt(this.value))"/>
      </div>`;
  }
  return `
    <div class="eb-question-card" id="ebqc-${sIdx}-${qIdx}">
      <div class="eb-qcard-hd">
        <div class="eb-qnum">${qIdx+1}</div>
        <span style="font-size:.72rem;color:var(--muted);font-weight:600">${typeLabel}</span>
        ${badge}
        <div style="margin-left:auto;display:flex;gap:.3rem">
          <button onclick="ebOpenMathModal('ebqt-${sIdx}-${qIdx}')" style="background:none;border:none;cursor:pointer;font-size:.82rem;color:var(--muted)" title="Insert equation">√</button>
          <button onclick="ebRemoveQ(${sIdx},${qIdx})" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:.9rem" title="Delete">✕</button>
        </div>
      </div>
      <div class="eb-qcard-body">${body}</div>
    </div>`;
}

function ebAddQuestion(sIdx) {
  const sec = EB.sections[sIdx]; if (!sec) return;
  sec.questions.push({ id:ebGenId(), question:'', marks:sec.marksPerQuestion||2, options:sec.type==='mcq'?['','','','']:[], answer:sec.type==='mcq'?'A':'', subParts:[], aiGenerated:false });
  ebRenderQuestionBuilder();
  setTimeout(() => { const ta = document.getElementById(`ebqt-${sIdx}-${sec.questions.length-1}`); if(ta) ta.focus(); }, 80);
}
function ebRemoveQ(sIdx, qIdx) { EB.sections[sIdx].questions.splice(qIdx,1); ebRenderQuestionBuilder(); }
function ebUpdateQ(sIdx, qIdx, key, value) { if (EB.sections[sIdx]?.questions[qIdx]) EB.sections[sIdx].questions[qIdx][key] = value; }
function ebUpdateOpt(sIdx, qIdx, oi, value) {
  const q = EB.sections[sIdx]?.questions[qIdx]; if (!q) return;
  if (!q.options) q.options = ['','','',''];
  q.options[oi] = value;
}

// ─── Sync DOM to state ────────────────────────────────────────────────────────
function ebSyncDOM() {
  EB.sections.forEach((sec, sIdx) => {
    sec.questions.forEach((q, qIdx) => {
      const ta = document.getElementById(`ebqt-${sIdx}-${qIdx}`);
      if (ta) q.question = ta.value;
    });
  });
}

// ─── Exam Preview ─────────────────────────────────────────────────────────────
function ebRenderPreview() {
  const h = ebGetHeader();
  const instructions = ebGetInstructions();
  const totalMarks = EB.sections.reduce((s,sec) => s+(sec.totalMarks||0), 0);
  const el = document.getElementById('ebExamPreview');
  if (!el) return;
  const letters = ['a','b','c','d','e','f'];
  el.innerHTML = `
    <h2>${ebEscape((h.schoolName||'SCHOOL NAME').toUpperCase())}</h2>
    <div class="ebep-subject">${ebEscape(h.subject.toUpperCase())} – ${ebEscape(h.class.toUpperCase())}</div>
    <div class="ebep-type">${ebEscape(h.examType.toUpperCase())}</div>
    <div class="ebep-meta">TIME: ${ebEscape(h.duration||'N/A')} &nbsp;|&nbsp; DATE: ${ebEscape(h.date||'')} &nbsp;|&nbsp; TOTAL: ${totalMarks} MARKS</div>
    <hr style="border:1.5px solid #000;margin:.5rem 0"/>
    ${instructions.length ? `<div style="margin-bottom:.75rem"><div style="font-weight:bold;font-size:.82rem;text-decoration:underline;margin-bottom:.35rem">INSTRUCTIONS:</div>${instructions.map((t,i) => `<div style="font-size:.78rem;margin-bottom:2px">${i+1}. ${ebEscape(t)}</div>`).join('')}</div><hr style="border:1px solid #ccc;margin:.5rem 0"/>` : ''}
    ${EB.sections.map((sec, sIdx) => `
      <div class="ebep-sectitle">SECTION ${ebEscape(sec.name)}: ${ebTypeLabel(sec.type).toUpperCase()} (${sec.totalMarks} MARKS)</div>
      ${sec.instruction ? `<div style="font-style:italic;font-size:.78rem;margin-bottom:.4rem">${ebEscape(sec.instruction)}</div>` : ''}
      ${sec.questions.map((q, qIdx) => `
        <div class="ebep-q">
          <strong>${qIdx+1}. ${ebEscape(q.question||'[Question text]')}</strong> <em style="font-size:.72rem;color:#666">(${q.marks} mark${q.marks!==1?'s':''})</em>
          ${q.subParts?.length ? `<div class="ebep-opts">${q.subParts.map((p,pi) => `<div class="ebep-opt">(${letters[pi]}) ${ebEscape(p.text)} <em>(${p.marks} marks)</em></div>`).join('')}</div>` : ''}
          ${q.options?.filter(Boolean).length ? `<div class="ebep-opts">${q.options.map((o,oi) => o?`<div class="ebep-opt">${['A','B','C','D'][oi]}) ${ebEscape(o)}</div>`:'').join('')}</div>` : ''}
          ${sec.type !== 'mcq' ? `<div style="margin-top:.3rem">${Array.from({length:sec.type==='essay'?12:4}).map(()=>'<div class="ebep-line"></div>').join('')}</div>` : ''}
        </div>`).join('')}
      ${!sec.questions.length ? `<div style="color:#aaa;font-size:.78rem">[No questions added yet]</div>` : ''}
    `).join('')}
    <div style="text-align:center;margin-top:1.5rem;font-weight:bold">*** END OF EXAM ***</div>`;
  if (window.MathJax) MathJax.typesetPromise([el]).catch(()=>{});
}

// ─── Collect Header ───────────────────────────────────────────────────────────
function ebGetHeader() {
  return {
    schoolName: document.getElementById('eb-schoolName')?.value || settings.schoolName || '',
    subject: document.getElementById('eb-subject')?.value || '',
    class: document.getElementById('eb-classLevel')?.value || '',
    examType: document.getElementById('eb-examType')?.value || 'Midterm',
    duration: document.getElementById('eb-duration')?.value || '',
    date: document.getElementById('eb-examDate')?.value || '',
    term: document.getElementById('eb-term')?.value || '',
    year: document.getElementById('eb-year')?.value || new Date().getFullYear()
  };
}

// ─── New / Reset exam ─────────────────────────────────────────────────────────
function ebNewExam() {
  EB.editingId = null;
  EB.currentStep = 1;
  EB.sections = [];
  ebInitSections();
  // Clear form fields
  ['eb-schoolName','eb-subject','eb-classLevel','eb-duration','eb-examDate'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const sn = document.getElementById('eb-schoolName'); if (sn) sn.value = settings.schoolName || '';
  const yr = document.getElementById('eb-year'); if (yr) yr.value = settings.currentYear || new Date().getFullYear();
  const dt = document.getElementById('eb-examDate'); if (dt) dt.value = new Date().toISOString().split('T')[0];
  document.getElementById('ebInstructionsList').innerHTML = '';
  ebAddInstruction('Write your name and admission number on the answer sheet.');
  ebGoToStep(1);
}

// ─── Save Exam ────────────────────────────────────────────────────────────────
function ebSaveExam() {
  ebSyncDOM();
  const header = ebGetHeader();
  if (!header.subject) { showToast('Please fill in exam details first (Step 1)', 'error'); return; }
  const instructions = ebGetInstructions();
  const totalMarks = EB.sections.reduce((s,sec) => s+(sec.totalMarks||0), 0);
  const examData = { header, instructions, sections: JSON.parse(JSON.stringify(EB.sections)), totalMarks, createdAt: new Date().toISOString() };

  const exams = ebLoad();
  if (EB.editingId) {
    const idx = exams.findIndex(e => e.id === EB.editingId);
    if (idx > -1) { examData.id = EB.editingId; exams[idx] = examData; }
    else { examData.id = ebGenId(); exams.push(examData); EB.editingId = examData.id; }
  } else {
    examData.id = ebGenId();
    EB.editingId = examData.id;
    exams.push(examData);
  }
  ebSave(exams);
  showToast('Exam saved successfully! 💾', 'success');
}

// ─── Render Saved Exams ───────────────────────────────────────────────────────
function ebRenderSavedExams() {
  const exams = ebLoad();
  const search = (document.getElementById('ebSavedSearch')?.value || '').toLowerCase();
  const filtered = exams.filter(e => {
    const txt = `${e.header?.subject||''} ${e.header?.schoolName||''} ${e.header?.examType||''} ${e.header?.class||''}`.toLowerCase();
    return !search || txt.includes(search);
  });
  const c = document.getElementById('ebSavedList');
  if (!c) return;
  if (!filtered.length) {
    c.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)"><div style="font-size:2rem">📁</div><p style="margin-top:.5rem">No saved exams yet</p></div>';
    return;
  }
  c.innerHTML = filtered.slice().reverse().map(e => `
    <div class="eb-exam-item">
      <div class="eb-exam-icon">📄</div>
      <div class="eb-exam-info">
        <div class="eb-exam-title">${ebEscape(e.header?.subject||'Untitled')} — ${ebEscape(e.header?.examType||'')}</div>
        <div class="eb-exam-meta">${ebEscape(e.header?.schoolName||'')} · ${ebEscape(e.header?.class||'')} · ${e.totalMarks} marks · ${e.sections?.length||0} sections</div>
      </div>
      <div class="eb-exam-actions">
        <button class="btn btn-outline btn-sm" onclick="ebLoadExamForEdit('${e.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="ebExportExamPDF('${e.id}')">⬇ PDF</button>
        <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="ebDeleteExam('${e.id}')">🗑</button>
      </div>
    </div>`).join('');
}

function ebDeleteExam(id) {
  if (!confirm('Delete this exam?')) return;
  const exams = ebLoad().filter(e => e.id !== id);
  ebSave(exams);
  ebRenderSavedExams();
  showToast('Exam deleted', 'success');
}

function ebLoadExamForEdit(id) {
  const exams = ebLoad();
  const exam = exams.find(e => e.id === id);
  if (!exam) return;
  EB.editingId = id;
  EB.sections = JSON.parse(JSON.stringify(exam.sections || []));
  const h = exam.header || {};
  // Switch to Create tab
  openEBTab('tabEBCreate', document.querySelector('#ebTabBar .tb'));
  setTimeout(() => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('eb-schoolName', h.schoolName);
    setVal('eb-subject', h.subject);
    setVal('eb-classLevel', h.class);
    setVal('eb-examType', h.examType);
    setVal('eb-duration', h.duration);
    setVal('eb-examDate', h.date);
    setVal('eb-term', h.term);
    setVal('eb-year', h.year);
    // Restore instructions
    const list = document.getElementById('ebInstructionsList');
    if (list) {
      list.innerHTML = '';
      (exam.instructions || []).forEach(t => ebAddInstruction(t));
    }
    ebGoToStep(1);
    showToast('Exam loaded for editing', 'success');
  }, 100);
}

// ─── Export PDF ───────────────────────────────────────────────────────────────
function ebExportPDF() {
  ebSyncDOM();
  const header = ebGetHeader();
  const instructions = ebGetInstructions();
  const totalMarks = EB.sections.reduce((s,sec) => s+(sec.totalMarks||0), 0);
  ebClientSidePDF({ header, instructions, sections: EB.sections, totalMarks });
}
function ebExportExamPDF(id) {
  const exam = ebLoad().find(e => e.id === id);
  if (exam) ebClientSidePDF(exam);
}
function ebClientSidePDF(exam) {
  if (!window.jspdf) { showToast('PDF library not loaded', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const { header, sections, instructions, totalMarks } = exam;
  let y = 20; const lm = 15, pw = 180, maxY = 280;
  const addPage = (need=10) => { if (y+need > maxY) { doc.addPage(); y=20; } };

  doc.setFont('Helvetica','bold'); doc.setFontSize(15);
  doc.text((header.schoolName||'SCHOOL').toUpperCase(), 105, y, {align:'center'}); y+=8;
  doc.setFontSize(12);
  doc.text(`${(header.subject||'').toUpperCase()} – ${(header.class||'').toUpperCase()}`, 105, y, {align:'center'}); y+=7;
  doc.setFontSize(11);
  doc.text((header.examType||'').toUpperCase(), 105, y, {align:'center'}); y+=6;
  doc.setFont('Helvetica','normal'); doc.setFontSize(10);
  doc.text(`TIME: ${header.duration||'N/A'}     DATE: ${header.date||''}     TOTAL: ${totalMarks} MARKS`, 105, y, {align:'center'}); y+=5;
  doc.setLineWidth(.8); doc.line(lm, y, lm+pw, y); y+=6;

  if (instructions?.length) {
    doc.setFont('Helvetica','bold'); doc.setFontSize(10); doc.text('INSTRUCTIONS:', lm, y); y+=4;
    doc.setFont('Helvetica','normal'); doc.setFontSize(9);
    instructions.forEach((t,i) => { addPage(5); const ls = doc.splitTextToSize(`${i+1}. ${t}`,pw); doc.text(ls,lm,y); y+=ls.length*4.5; });
    y+=3;
  }

  sections.forEach(sec => {
    addPage(12); doc.setFont('Helvetica','bold'); doc.setFontSize(11);
    doc.text(`SECTION ${sec.name}: ${ebTypeLabel(sec.type).toUpperCase()} (${sec.totalMarks} MARKS)`, lm, y); y+=6;
    if (sec.instruction) { doc.setFont('Helvetica','italic'); doc.setFontSize(9); const ls=doc.splitTextToSize(sec.instruction,pw); doc.text(ls,lm,y); y+=ls.length*4.5; }
    y+=2;
    sec.questions.forEach((q, qIdx) => {
      addPage(14); doc.setFont('Helvetica','bold'); doc.setFontSize(10);
      const qText = `${qIdx+1}. ${q.question||'[Question]'}  (${q.marks} marks)`;
      const qls = doc.splitTextToSize(qText, pw); doc.text(qls, lm, y); y+=qls.length*5;
      doc.setFont('Helvetica','normal'); doc.setFontSize(9);
      if (sec.type==='mcq' && q.options) {
        const labs=['A)','B)','C)','D)']; q.options.forEach((o,oi) => { if(o){addPage(5); doc.text(`   ${labs[oi]} ${o}`,lm,y); y+=4.5;} });
      }
      if (sec.type==='structured') {
        if (q.subParts?.length) { const ls=['a','b','c','d']; q.subParts.forEach((p,pi) => { addPage(5); doc.text(`   (${ls[pi]}) ${p.text}  (${p.marks} marks)`,lm,y); y+=4.5; }); }
        doc.setDrawColor(180); doc.setLineWidth(.2);
        for (let l=0;l<(q.marks<=3?3:q.marks<=6?5:8);l++){addPage(6);y+=5.5;doc.line(lm,y,lm+pw,y);}
        doc.setDrawColor(0);
      }
      if (sec.type==='essay') {
        doc.setDrawColor(180); doc.setLineWidth(.2);
        for (let l=0;l<12;l++){addPage(6);y+=5.5;doc.line(lm,y,lm+pw,y);}
        doc.setDrawColor(0);
      }
      y+=4;
    });
    y+=5;
  });
  addPage(10); doc.setFont('Helvetica','bold'); doc.setFontSize(11);
  doc.text('*** END OF EXAM ***', 105, y, {align:'center'});
  const fn = `${header.schoolName||'Exam'}_${header.subject}_${header.examType}.pdf`.replace(/[^a-z0-9_\-\.]/gi,'_');
  doc.save(fn);
  showToast('PDF downloaded! 📄', 'success');
}

// ─── AI Calls (direct browser → Anthropic API) ───────────────────────────────
function ebGetApiKey() {
  return load(K.settings)[0]?.ebApiKey || settings?.ebApiKey || '';
}

async function ebCallClaude(prompt, systemPrompt) {
  const key = ebGetApiKey();
  if (!key) throw new Error('No API key set. Go to Settings → Exam Builder to add your Anthropic API key.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key': key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:4000, system: systemPrompt, messages:[{role:'user',content:prompt}] })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message || `API error ${res.status}`); }
  const data = await res.json();
  return data.content.map(b=>b.text||'').join('');
}

async function ebGenerateQuestionsAPI(params) {
  const { subject, topic, questionType, difficulty, count, notes } = params;
  const diffGuide = { easy:'Simple, direct recall questions.', medium:'Mix of recall and application.', hard:'Analysis, synthesis and evaluation.' };
  const system = `You are an expert exam paper creator for Kenyan/East African secondary school curriculum. ALWAYS respond with ONLY valid JSON (no markdown):
{"questions":[{"id":"q1","question":"...","type":"mcq|structured|essay","marks":2,"options":["A) ...","B) ...","C) ...","D) ..."],"answer":"B) ...","explanation":"...","difficulty":"easy|medium|hard","subParts":[]}]}
For MCQ: 4 options, correct answer. For structured/essay: options=[], answer="".`;
  const userPrompt = `Generate ${count||5} ${questionType||'mcq'} questions.
Subject: ${subject||'General'} | Topic: ${topic||'General'} | Difficulty: ${difficulty||'medium'} — ${diffGuide[difficulty]||diffGuide.medium}
${notes?`Based on: ${notes.substring(0,2500)}`:''}
Ensure questions test different skills: recall, comprehension, application, analysis.`;
  const text = await ebCallClaude(userPrompt, system);
  const clean = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  const parsed = JSON.parse(clean);
  return parsed.questions || [];
}

async function ebGenerateMarkingSchemeAPI(exam) {
  const system = 'You are an expert marking scheme creator. Respond ONLY with valid JSON (no markdown): {"scheme":[{"questionRef":"Q1","marks":2,"expectedAnswer":"...","markingPoints":["point1","point2"]}]}';
  const questionsText = exam.sections.map((sec,si) => `Section ${sec.name} (${sec.type}):\n${sec.questions.map((q,qi) => `Q${qi+1}: ${q.question} (${q.marks} marks)${q.answer?` Answer: ${q.answer}`:''}`).join('\n')}`).join('\n\n');
  const userPrompt = `Create a marking scheme for:\nSubject: ${exam.header?.subject||''} | Class: ${exam.header?.class||''}\n\n${questionsText}`;
  const text = await ebCallClaude(userPrompt, system);
  const clean = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(clean).scheme || [];
}

// ─── AI Generator Tab ────────────────────────────────────────────────────────
let _ebAiDiff = 'easy';
function ebSetDiff(btn, diff) {
  _ebAiDiff = diff;
  document.querySelectorAll('.ebai-diff').forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
}

async function ebAIGenerate() {
  const subject = document.getElementById('ebai-subject')?.value?.trim();
  const topic = document.getElementById('ebai-topic')?.value?.trim();
  const type = document.getElementById('ebai-type')?.value || 'mcq';
  const count = parseInt(document.getElementById('ebai-count')?.value) || 5;
  const notes = document.getElementById('ebai-notes')?.value?.trim() || '';
  if (!subject && !topic) { showToast('Please enter subject or topic', 'error'); return; }
  const btn = document.getElementById('ebaiGenBtn');
  btn.disabled = true; btn.textContent = '⏳ Generating...';
  const resultsEl = document.getElementById('ebaiResults');
  resultsEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)"><div style="font-size:2rem;animation:spin 1s linear infinite;display:inline-block">⏳</div><p style="margin-top:.5rem">AI is generating questions...</p></div>';
  try {
    const qs = await ebGenerateQuestionsAPI({ subject, topic, questionType:type, difficulty:_ebAiDiff, count, notes });
    EB.genAiResults = qs;
    if (!qs.length) { resultsEl.innerHTML = '<p style="text-align:center;color:var(--muted);padding:2rem">No questions generated.</p>'; return; }
    document.getElementById('ebaiAddAllBtn').style.display = 'inline-flex';
    resultsEl.innerHTML = qs.map((q,i) => `
      <div class="eb-gen-q">
        <div class="eb-gen-q-text">${i+1}. ${ebEscape(q.question)}</div>
        ${q.options?.length ? `<div>${q.options.map(o=>`<div style="font-size:.78rem;color:var(--muted);margin-bottom:2px">${ebEscape(o)}</div>`).join('')}</div>` : ''}
        ${q.answer ? `<div class="eb-gen-q-ans">✓ ${ebEscape(q.answer)}</div>` : ''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--border-lt)">
          <span style="font-size:.72rem;background:var(--primary-lt);color:var(--primary);padding:1px 8px;border-radius:12px">${q.type||type} · ${q.marks||2} marks</span>
          <button class="btn btn-outline btn-sm" onclick="ebaiAddSingle(${i})" style="font-size:.76rem">➕ Add to Exam</button>
        </div>
      </div>`).join('');
    showToast(`Generated ${qs.length} questions! 🤖`, 'success');
  } catch (err) {
    resultsEl.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--danger)"><div>❌</div><p style="margin-top:.5rem">${ebEscape(err.message)}</p></div>`;
    showToast('Generation failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '🤖 Generate Questions';
  }
}
function ebaiAddAllToExam() {
  EB.genAiResults.forEach(q => ebStagePendingQ(q));
  showToast(`${EB.genAiResults.length} questions staged for exam`, 'success');
  openEBTab('tabEBCreate', document.querySelector('#ebTabBar .tb'));
  ebGoToStep(3);
}
function ebaiAddSingle(idx) {
  ebStagePendingQ(EB.genAiResults[idx]);
  showToast('Question staged for exam', 'success');
}
function ebStagePendingQ(q) {
  const sec = EB.sections.find(s => s.type === q.type) || EB.sections[0];
  if (!sec) return;
  sec.questions.push({ id:ebGenId(), question:q.question, marks:q.marks||sec.marksPerQuestion||2, options:q.options||[], answer:q.answer||'', subParts:q.subParts||[], aiGenerated:true });
}

// ─── AI per-section modal ─────────────────────────────────────────────────────
let _ebModalDiff = 'medium';
function ebSetModalDiff(btn, diff) {
  _ebModalDiff = diff;
  document.querySelectorAll('.eb-mdiff').forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
}
function ebOpenAIModal(sIdx) {
  EB.aiSectionIdx = sIdx;
  const sec = EB.sections[sIdx];
  document.getElementById('ebAIModalSecName').textContent = sec?.name || sIdx+1;
  document.getElementById('ebModal-topic').value = document.getElementById('eb-subject')?.value || '';
  document.getElementById('ebModal-notes').value = '';
  document.getElementById('ebAISectionModal').style.display = 'flex';
}
async function ebGenForSection() {
  const sec = EB.sections[EB.aiSectionIdx]; if (!sec) return;
  const topic = document.getElementById('ebModal-topic')?.value?.trim();
  const notes = document.getElementById('ebModal-notes')?.value?.trim() || '';
  const subject = document.getElementById('eb-subject')?.value?.trim() || '';
  document.getElementById('ebAISectionModal').style.display = 'none';
  ebShowLoading('AI generating questions...');
  try {
    const qs = await ebGenerateQuestionsAPI({ subject, topic:topic||subject, questionType:sec.type, difficulty:_ebModalDiff, count:sec.questionCount||5, notes });
    qs.forEach(q => sec.questions.push({ id:ebGenId(), question:q.question, marks:q.marks||sec.marksPerQuestion||2, options:q.options||[], answer:q.answer||'', subParts:q.subParts||[], aiGenerated:true }));
    ebRenderQuestionBuilder();
    showToast(`Generated ${qs.length} questions for Section ${sec.name}!`, 'success');
  } catch(err) { showToast('Failed: ' + err.message, 'error'); }
  finally { ebHideLoading(); }
}

// ─── Generate All Sections ────────────────────────────────────────────────────
let _ebGaDiff = 'medium';
function ebSetGaDiff(btn, diff) {
  _ebGaDiff = diff;
  document.querySelectorAll('.eb-gadiff').forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
}
function ebOpenGenAllModal() {
  const previewEl = document.getElementById('ebGenAllPreview');
  if (previewEl) previewEl.innerHTML = `<strong style="color:var(--primary)">Will generate for ${EB.sections.length} section(s):</strong><br>` +
    EB.sections.map((s,i) => `<span style="font-size:.78rem;margin-right:.5rem">${EB.spColors[i%EB.spColors.length]?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${EB.spColors[i%EB.spColors.length]};margin-right:3px"></span>`:''}Section ${s.name} — ${ebTypeLabel(s.type)} (${s.questionCount} Qs)</span>`).join('');
  document.getElementById('ebGenAllModal').style.display = 'flex';
}
async function ebDoGenAll() {
  document.getElementById('ebGenAllModal').style.display = 'none';
  const notes = document.getElementById('ebGenAll-notes')?.value?.trim() || '';
  const topics = document.getElementById('ebGenAll-topics')?.value?.trim() || '';
  const subject = document.getElementById('eb-subject')?.value || '';
  ebShowLoading(`Generating for ${EB.sections.length} sections...`);
  let total = 0;
  try {
    await Promise.all(EB.sections.map((sec, sIdx) =>
      ebGenerateQuestionsAPI({ subject, topic:topics||subject, questionType:sec.type, difficulty:_ebGaDiff, count:sec.questionCount||5, notes })
        .then(qs => { qs.forEach(q => { EB.sections[sIdx].questions.push({ id:ebGenId(), question:q.question, marks:q.marks||sec.marksPerQuestion||2, options:q.options||[], answer:q.answer||'', subParts:q.subParts||[], aiGenerated:true }); }); total+=qs.length; })
        .catch(err => console.warn('Section', sec.name, err))
    ));
    ebRenderQuestionBuilder();
    showToast(`✅ Generated ${total} questions across all sections!`, 'success');
  } catch(err) { showToast('Generation failed: ' + err.message, 'error'); }
  finally { ebHideLoading(); }
}

// ─── Marking Scheme ───────────────────────────────────────────────────────────
function ebPopulateMsSelect() {
  const sel = document.getElementById('ebMsSelect');
  if (!sel) return;
  const exams = ebLoad();
  sel.innerHTML = '<option value="">— Select an exam —</option>' +
    exams.map(e => `<option value="${e.id}">${ebEscape(e.header?.subject||'Untitled')} — ${ebEscape(e.header?.examType||'')} (${ebEscape(e.header?.class||'')})</option>`).join('');
}
async function ebGenerateMarkingScheme() {
  const id = document.getElementById('ebMsSelect')?.value;
  if (!id) { showToast('Select an exam first', 'error'); return; }
  const exam = ebLoad().find(e => e.id === id);
  if (!exam) return;
  ebShowLoading('Generating marking scheme...');
  try {
    const scheme = await ebGenerateMarkingSchemeAPI(exam);
    const resultEl = document.getElementById('ebMsResult');
    const contentEl = document.getElementById('ebMsContent');
    if (resultEl) resultEl.style.display = 'block';
    if (contentEl) contentEl.innerHTML = scheme.map((item,i) => `
      <div style="margin-bottom:1rem;padding:.75rem;border:1px solid var(--border-lt);border-radius:8px">
        <div style="font-weight:700;margin-bottom:.3rem">${item.questionRef||`Q${i+1}`} — ${item.marks} marks</div>
        <div style="font-size:.85rem;color:var(--muted);margin-bottom:.4rem">${ebEscape(item.expectedAnswer||'')}</div>
        ${item.markingPoints?.length ? `<ul style="padding-left:1.25rem;font-size:.82rem">${item.markingPoints.map(p => `<li>${ebEscape(p)}</li>`).join('')}</ul>` : ''}
      </div>`).join('') || '<p style="color:var(--muted)">No scheme generated.</p>';
    showToast('Marking scheme generated! ✅', 'success');
  } catch(err) { showToast('Failed: ' + err.message, 'error'); }
  finally { ebHideLoading(); }
}
function ebExportMsPDF() {
  const content = document.getElementById('ebMsContent')?.innerHTML || '';
  if (!window.jspdf) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(13); doc.setFont('Helvetica','bold');
  doc.text('MARKING SCHEME', 105, 20, {align:'center'});
  doc.setFontSize(9); doc.setFont('Helvetica','normal');
  const tmp = document.createElement('div'); tmp.innerHTML = content;
  const lines = doc.splitTextToSize(tmp.innerText || '', 180);
  doc.text(lines, 15, 32);
  doc.save('marking-scheme.pdf');
}

// ─── Math Modal ───────────────────────────────────────────────────────────────
function ebOpenMathModal(targetId) {
  EB.mathTarget = targetId;
  const inp = document.getElementById('ebMathInput'); if(inp) inp.value = '';
  const prev = document.getElementById('ebMathPreview'); if(prev) prev.innerHTML = 'Preview here';
  document.getElementById('ebMathModal').style.display = 'flex';
}
function ebPreviewMath(val) {
  const prev = document.getElementById('ebMathPreview'); if (!prev) return;
  prev.innerHTML = `\\(${val}\\)`;
  if (window.MathJax) MathJax.typesetPromise([prev]).catch(()=>{});
}
function ebInsertMathSnippet(snip) {
  const inp = document.getElementById('ebMathInput'); if (!inp) return;
  inp.value += snip; ebPreviewMath(inp.value);
}
function ebInsertMathToQuestion() {
  const eq = document.getElementById('ebMathInput')?.value?.trim();
  if (!eq || !EB.mathTarget) { document.getElementById('ebMathModal').style.display='none'; return; }
  const target = document.getElementById(EB.mathTarget);
  if (target) { const p = target.selectionStart; target.value = target.value.slice(0,p) + ` \\(${eq}\\) ` + target.value.slice(p); }
  document.getElementById('ebMathModal').style.display = 'none';
}

// ─── Sub-Parts Modal ──────────────────────────────────────────────────────────
function ebOpenSubParts(sIdx, qIdx) {
  EB.subPartsSec = sIdx; EB.subPartsQ = qIdx;
  const q = EB.sections[sIdx]?.questions[qIdx];
  const list = document.getElementById('ebSubPartsList'); if (!list) return;
  list.innerHTML = (q?.subParts||[]).map((p,i) => `
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
      <input type="text" value="${ebEscape(p.text||'')}" placeholder="Sub-part text..." style="flex:1;padding:6px 10px;border:1.5px solid var(--border-lt);border-radius:6px;font-size:.82rem;outline:none" class="eb-sp-text"/>
      <input type="number" value="${p.marks||2}" min="1" max="20" style="width:58px;padding:6px 8px;border:1.5px solid var(--border-lt);border-radius:6px;font-size:.82rem;outline:none" class="eb-sp-marks"/>
      <button onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--danger)">✕</button>
    </div>`).join('');
  document.getElementById('ebSubPartsModal').style.display = 'flex';
}
function ebAddSubPart() {
  const list = document.getElementById('ebSubPartsList');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem';
  div.innerHTML = `<input type="text" placeholder="Sub-part text..." style="flex:1;padding:6px 10px;border:1.5px solid var(--border-lt);border-radius:6px;font-size:.82rem;outline:none" class="eb-sp-text"/>
    <input type="number" value="2" min="1" max="20" style="width:58px;padding:6px 8px;border:1.5px solid var(--border-lt);border-radius:6px;font-size:.82rem;outline:none" class="eb-sp-marks"/>
    <button onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--danger)">✕</button>`;
  list.appendChild(div);
}
function ebSaveSubParts() {
  const items = document.querySelectorAll('#ebSubPartsList > div');
  const parts = Array.from(items).map(d => ({ text: d.querySelector('.eb-sp-text')?.value||'', marks: parseInt(d.querySelector('.eb-sp-marks')?.value)||2 })).filter(p => p.text.trim());
  if (EB.sections[EB.subPartsSec]?.questions[EB.subPartsQ]) {
    EB.sections[EB.subPartsSec].questions[EB.subPartsQ].subParts = parts;
    ebRenderQuestionBuilder();
  }
  document.getElementById('ebSubPartsModal').style.display = 'none';
  showToast('Sub-parts saved', 'success');
}

// ─── Loading helpers ──────────────────────────────────────────────────────────
function ebShowLoading(text = 'Processing...') {
  const el = document.getElementById('ebLoadingOverlay'); if (el) { el.style.display = 'flex'; document.getElementById('ebLoadingText').textContent = text; }
}
function ebHideLoading() {
  const el = document.getElementById('ebLoadingOverlay'); if (el) el.style.display = 'none';
}

// ─── Integrate into main go() ─────────────────────────────────────────────────
// Patch the go() function to initialise Exam Builder when navigating to it
const _origGo_forEB = typeof go === 'function' ? go : null;

// Intercept section change to init EB on first visit
document.addEventListener('DOMContentLoaded', function() {
  const origGo = window.go;
  window.go = function(section, el) {
    if (section === 'exambuilder') {
      // Restrict to admins only
      const isAdmin = currentUser && (currentUser.role==='superadmin'||currentUser.role==='admin'||currentUser.role==='principal');
      const isTeacher = currentUser && currentUser.role==='teacher';
      if (!isAdmin && !isTeacher) { showToast('Exam Builder is not available for your role', 'error'); return; }
      // Init if first time
      if (!EB.sections.length) {
        ebInitSections();
        const sn = document.getElementById('eb-schoolName');
        if (sn && !sn.value && settings.schoolName) sn.value = settings.schoolName;
        const yr = document.getElementById('eb-year');
        if (yr) yr.value = settings.currentYear || new Date().getFullYear();
        const dt = document.getElementById('eb-examDate');
        if (dt && !dt.value) dt.value = new Date().toISOString().split('T')[0];
        const list = document.getElementById('ebInstructionsList');
        if (list && !list.children.length) ebAddInstruction('Write your name and admission number on the answer sheet.');
        ebSetupHeaderPreview();
        ebRenderSections();
      }
    }
    if (section === 'settings') {
      // Pre-fill EB API key when settings page is opened
      setTimeout(() => {
        const inp = document.getElementById('ebApiKeyInput');
        if (inp && !inp.value) { const k = ebGetApiKey(); if (k) inp.value = k; }
      }, 50);
    }
    if (origGo) origGo(section, el);
  };
});

// ─── Add API Key field to Settings ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Inject AI API key card into settings section
  const settingsSec = document.getElementById('s-settings');
  if (settingsSec) {
    const apiCard = document.createElement('div');
    apiCard.className = 'card';
    apiCard.id = 'ebApiKeyCard';
    apiCard.style.marginTop = '1.25rem';
    apiCard.innerHTML = `
      <h3 style="padding:.75rem 1.25rem .5rem;font-size:1rem">✏️ Exam Builder — AI Settings</h3>
      <div style="padding:.5rem 1.25rem 1rem">
        <div class="fg" style="margin-bottom:.75rem">
          <label>Anthropic API Key</label>
          <input type="password" id="ebApiKeyInput" placeholder="sk-ant-..." style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.9rem;outline:none"/>
          <div style="font-size:.76rem;color:var(--muted);margin-top:.3rem">Used by Exam Builder for AI question generation &amp; marking schemes. Key stored in browser localStorage.</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="ebSaveApiKey()">💾 Save API Key</button>
        <button class="btn btn-outline btn-sm" onclick="ebTestApiKey()" style="margin-left:.5rem">🔌 Test Connection</button>
        <span id="ebApiKeyStatus" style="margin-left:.75rem;font-size:.82rem"></span>
      </div>`;
    const secStack = settingsSec.querySelector('.sec-stack');
    if (secStack) secStack.appendChild(apiCard);
  }
});

function ebSaveApiKey() {
  const key = document.getElementById('ebApiKeyInput')?.value?.trim();
  if (!key) { showToast('Please enter an API key', 'error'); return; }
  settings.ebApiKey = key;
  save(K.settings, [settings]);
  showToast('API key saved! ✅', 'success');
  document.getElementById('ebApiKeyStatus').textContent = '';
}

async function ebTestApiKey() {
  const key = document.getElementById('ebApiKeyInput')?.value?.trim();
  if (!key) { showToast('Enter a key first', 'error'); return; }
  const statusEl = document.getElementById('ebApiKeyStatus');
  statusEl.textContent = '⏳ Testing...';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:10,messages:[{role:'user',content:'Hello'}]})
    });
    if (res.ok) { statusEl.innerHTML = '<span style="color:#10b981;font-weight:700">✅ Connected!</span>'; showToast('API key works! AI ready.', 'success'); }
    else { const e = await res.json().catch(()=>({})); statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${e.error?.message||'Invalid key'}</span>`; }
  } catch(err) { statusEl.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`; }
}

