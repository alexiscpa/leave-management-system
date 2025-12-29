// 部門請假管理系統 - 核心邏輯

// ========== 資料結構 ==========
const WORK_HOURS = [
    '08:30', '09:30', '10:30', '11:30', '12:30',
    '13:30', '14:30', '15:30', '16:30'
]; // 9個小時

// 所有時間點（包含結束時間17:30）用於時間計算
const ALL_TIMES = [
    '08:30', '09:30', '10:30', '11:30', '12:30',
    '13:30', '14:30', '15:30', '16:30', '17:30'
];

// 初始化員工資料
function initializeEmployees() {
    const defaultEmployees = [
        { id: 'A', name: '員工A', proxyId: 'B' },
        { id: 'B', name: '員工B', proxyId: 'A' },
        { id: 'C', name: '員工C', proxyId: 'D' },
        { id: 'D', name: '員工D', proxyId: 'C' },
        { id: 'E', name: '員工E', proxyId: 'F' },
        { id: 'F', name: '員工F', proxyId: 'E' },
        { id: 'G', name: '員工G', proxyId: 'H' },
        { id: 'H', name: '員工H', proxyId: 'G' },
        { id: 'I', name: '員工I', proxyId: 'J' },
        { id: 'J', name: '員工J', proxyId: 'I' }
    ];

    if (!localStorage.getItem('employees')) {
        localStorage.setItem('employees', JSON.stringify(defaultEmployees));
    }
}

// 初始化請假紀錄
function initializeLeaveRecords() {
    if (!localStorage.getItem('leaveRecords')) {
        localStorage.setItem('leaveRecords', JSON.stringify([]));
    }
}

// ========== 資料存取函數 ==========
function getEmployees() {
    return JSON.parse(localStorage.getItem('employees') || '[]');
}

function saveEmployees(employees) {
    localStorage.setItem('employees', JSON.stringify(employees));
}

function getLeaveRecords() {
    return JSON.parse(localStorage.getItem('leaveRecords') || '[]');
}

function saveLeaveRecords(records) {
    localStorage.setItem('leaveRecords', JSON.stringify(records));
}

function getEmployeeById(id) {
    const employees = getEmployees();
    return employees.find(emp => emp.id === id);
}

function getEmployeeProxy(employeeId) {
    const employee = getEmployeeById(employeeId);
    return employee ? employee.proxyId : null;
}

// ========== 日期與時間工具函數 ==========
function getWeeksInMonth(year, month) {
    const weeks = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let currentMonday = new Date(firstDay);
    const dayOfWeek = currentMonday.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentMonday.setDate(currentMonday.getDate() + diff);

    while (currentMonday <= lastDay) {
        const weekStart = new Date(currentMonday);
        const weekEnd = new Date(currentMonday);
        weekEnd.setDate(weekEnd.getDate() + 4);

        weeks.push({
            start: new Date(weekStart),
            end: new Date(weekEnd),
            label: `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
        });

        currentMonday.setDate(currentMonday.getDate() + 7);
    }

    return weeks;
}

function getWorkDaysInWeek(weekStart) {
    const days = [];
    for (let i = 0; i < 5; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        days.push(day);
    }
    return days;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
}

// ========== 請假記錄查詢函數 ==========
function getLeavesByDateAndTime(date, time) {
    const records = getLeaveRecords();
    const dateStr = formatDate(date);

    return records.filter(record => {
        if (record.date !== dateStr) return false;
        // 只顯示已核准的請假，待審和已拒絕的都不顯示
        if (record.status !== 'approved') return false;

        const startIdx = ALL_TIMES.indexOf(record.startTime);
        const endIdx = ALL_TIMES.indexOf(record.endTime);
        const timeIdx = WORK_HOURS.indexOf(time);

        return timeIdx >= startIdx && timeIdx < endIdx;
    });
}

function getProxyTasks(employeeId, date, time) {
    const records = getLeaveRecords();
    const dateStr = formatDate(date);
    const proxyFor = [];

    records.forEach(record => {
        if (record.date !== dateStr) return;
        if (record.status === 'rejected') return;

        const employee = getEmployeeById(record.employeeId);
        if (!employee || employee.proxyId !== employeeId) return;

        const startIdx = ALL_TIMES.indexOf(record.startTime);
        const endIdx = ALL_TIMES.indexOf(record.endTime);
        const timeIdx = WORK_HOURS.indexOf(time);

        if (timeIdx >= startIdx && timeIdx < endIdx) {
            proxyFor.push(record);
        }
    });

    return proxyFor;
}

// 檢查代理人是否在同時段請假
function checkProxyConflict(employeeId, date, startTime, endTime) {
    const employee = getEmployeeById(employeeId);
    if (!employee || !employee.proxyId) {
        return [];
    }

    const proxyId = employee.proxyId;
    const records = getLeaveRecords();
    const dateStr = formatDate(date);

    const startIdx = ALL_TIMES.indexOf(startTime);
    const endIdx = ALL_TIMES.indexOf(endTime);

    const conflicts = [];

    // 檢查代理人在該日期是否有請假記錄
    const proxyLeaves = records.filter(record => {
        if (record.employeeId !== proxyId) return false;
        if (record.date !== dateStr) return false;
        if (record.status === 'rejected') return false;
        return true;
    });

    // 檢查時間是否重疊
    proxyLeaves.forEach(leave => {
        const leaveStartIdx = ALL_TIMES.indexOf(leave.startTime);
        const leaveEndIdx = ALL_TIMES.indexOf(leave.endTime);

        // 檢查時間區間是否重疊
        if (!(endIdx <= leaveStartIdx || startIdx >= leaveEndIdx)) {
            conflicts.push({
                leave: leave,
                proxyName: getEmployeeById(proxyId).name
            });
        }
    });

    return conflicts;
}

// ========== UI 初始化 ==========
function initializeUI() {
    initializeEmployees();
    initializeLeaveRecords();

    setupTabs();
    setupDateSelectors();
    setupUserSelector();
    setupLeaveForm();
    setupModal();

    renderCalendar();
    updateApprovalList();
    updateEmployeeList();
}

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabName).classList.add('active');

            if (tabName === 'calendar') {
                renderCalendar();
            } else if (tabName === 'approval') {
                updateApprovalList();
            } else if (tabName === 'settings') {
                updateEmployeeList();
            }
        });
    });
}

function setupDateSelectors() {
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    const weekSelect = document.getElementById('weekSelect');

    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = `${year}年`;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }

    for (let month = 1; month <= 12; month++) {
        const option = document.createElement('option');
        option.value = month - 1;
        option.textContent = `${month}月`;
        if (month === new Date().getMonth() + 1) option.selected = true;
        monthSelect.appendChild(option);
    }

    function updateWeekSelector() {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const weeks = getWeeksInMonth(year, month);

        weekSelect.innerHTML = '';
        weeks.forEach((week, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `第${index + 1}週 (${week.label})`;
            weekSelect.appendChild(option);
        });

        renderCalendar();
    }

    yearSelect.addEventListener('change', updateWeekSelector);
    monthSelect.addEventListener('change', updateWeekSelector);
    weekSelect.addEventListener('change', () => renderCalendar());

    updateWeekSelector();
}

function setupUserSelector() {
    const currentUserSelect = document.getElementById('currentUser');
    const employees = getEmployees();

    currentUserSelect.innerHTML = '';
    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.name;
        currentUserSelect.appendChild(option);
    });

    currentUserSelect.addEventListener('change', () => {
        updateLeaveFormUser();
    });

    updateLeaveFormUser();
}

function setupLeaveForm() {
    const startTimeSelect = document.getElementById('startTime');
    const endTimeSelect = document.getElementById('endTime');

    WORK_HOURS.forEach((time, index) => {
        const option1 = document.createElement('option');
        option1.value = time;
        option1.textContent = time;
        startTimeSelect.appendChild(option1);

        if (index < WORK_HOURS.length - 1) {
            const option2 = document.createElement('option');
            option2.value = WORK_HOURS[index + 1];
            option2.textContent = WORK_HOURS[index + 1];
            endTimeSelect.appendChild(option2);
        }
    });

    const lastOption = document.createElement('option');
    lastOption.value = '17:30';
    lastOption.textContent = '17:30';
    endTimeSelect.appendChild(lastOption);

    function updateLeaveHours() {
        const startTime = startTimeSelect.value;
        const endTime = endTimeSelect.value;

        if (startTime && endTime) {
            const startIdx = ALL_TIMES.indexOf(startTime);
            const endIdx = ALL_TIMES.indexOf(endTime);

            if (endIdx > startIdx) {
                document.getElementById('leaveHours').value = `${endIdx - startIdx} 小時`;
            } else {
                document.getElementById('leaveHours').value = '請選擇有效時間範圍';
            }
        }
    }

    startTimeSelect.addEventListener('change', updateLeaveHours);
    endTimeSelect.addEventListener('change', updateLeaveHours);

    const leaveForm = document.getElementById('leaveForm');
    leaveForm.addEventListener('submit', handleLeaveSubmit);

    updateLeaveHours();
}

function updateLeaveFormUser() {
    const currentUserId = document.getElementById('currentUser').value;
    const employee = getEmployeeById(currentUserId);
    document.getElementById('applicantName').value = employee ? employee.name : '';
}

function setupModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');

    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// ========== 週曆視圖渲染 ==========
function renderCalendar() {
    const year = parseInt(document.getElementById('yearSelect').value);
    const month = parseInt(document.getElementById('monthSelect').value);
    const weekIndex = parseInt(document.getElementById('weekSelect').value);

    const weeks = getWeeksInMonth(year, month);
    if (weekIndex >= weeks.length) return;

    const selectedWeek = weeks[weekIndex];
    const workDays = getWorkDaysInWeek(selectedWeek.start);

    let html = '<table class="calendar-table">';

    // 表頭：橫軸為日期（週一到週五）
    html += '<thead><tr>';
    html += '<th class="time-header">時段</th>';
    workDays.forEach(day => {
        html += `<th class="day-header">${formatDateDisplay(day)}</th>`;
    });
    html += '</tr></thead>';

    // 表格主體：縱軸為時間
    html += '<tbody>';
    WORK_HOURS.forEach((time, index) => {
        // 計算結束時間
        const endTime = index < WORK_HOURS.length - 1 ? WORK_HOURS[index + 1] : '17:30';
        const timeRange = `${time}-${endTime}`;

        html += '<tr>';
        html += `<td class="time-label">${timeRange}</td>`;

        // 每一天的儲存格
        workDays.forEach(day => {
            const leaves = getLeavesByDateAndTime(day, time);

            // 收集該時段所有請假和代理的員工
            const employeeInfo = [];

            // 收集請假的員工（只顯示已核准的請假）
            leaves.forEach(leave => {
                const employee = getEmployeeById(leave.employeeId);
                if (employee) {
                    employeeInfo.push({
                        name: employee.name,
                        status: '請假',
                        className: 'leave',
                        isProxy: false
                    });
                }
            });

            // 渲染儲存格
            let cellClass = 'time-cell';
            html += `<td class="${cellClass}">`;

            if (employeeInfo.length > 0) {
                employeeInfo.forEach(info => {
                    html += `<div class="employee-tag ${info.className}">`;
                    html += `${info.name}`;
                    html += `</div>`;
                });
            }

            html += '</td>';
        });

        html += '</tr>';
    });
    html += '</tbody>';

    html += '</table>';

    document.getElementById('calendarView').innerHTML = html;
}

// ========== 請假申請處理 ==========
function handleLeaveSubmit(e) {
    e.preventDefault();

    const currentUserId = document.getElementById('currentUser').value;
    const employee = getEmployeeById(currentUserId);
    const leaveDate = document.getElementById('leaveDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const reason = document.getElementById('leaveReason').value;

    if (!leaveDate || !startTime || !endTime || !reason) {
        alert('請填寫完整資料');
        return;
    }

    const startIdx = ALL_TIMES.indexOf(startTime);
    const endIdx = ALL_TIMES.indexOf(endTime);

    if (startIdx === -1 || endIdx === -1) {
        alert('請選擇有效的時間');
        return;
    }

    if (endIdx <= startIdx) {
        alert('結束時間必須晚於開始時間');
        return;
    }

    const date = new Date(leaveDate);
    const conflicts = checkProxyConflict(currentUserId, date, startTime, endTime);

    let needsSpecialApproval = false;
    let status = 'approved'; // 預設直接核准

    if (conflicts.length > 0) {
        const proxyEmployee = getEmployeeById(employee.proxyId);
        const confirmMsg = `您的代理人 ${proxyEmployee.name} 在此時段也有請假，需要主管特別核准。是否繼續申請？`;
        if (!confirm(confirmMsg)) {
            return;
        }
        needsSpecialApproval = true;
        status = 'pending'; // 有衝突時需要主管核准
    }

    const records = getLeaveRecords();
    const newRecord = {
        id: Date.now().toString(),
        employeeId: currentUserId,
        employeeName: employee.name,
        date: leaveDate,
        startTime: startTime,
        endTime: endTime,
        reason: reason,
        status: status,
        needsSpecialApproval: needsSpecialApproval,
        appliedAt: new Date().toISOString()
    };

    records.push(newRecord);
    saveLeaveRecords(records);

    if (needsSpecialApproval) {
        alert('請假申請已提交，因代理人有請假衝突，需等待主管核准');
    } else {
        alert('請假申請已核准！您的請假資訊已公開給所有人查看');
    }

    document.getElementById('leaveForm').reset();
    updateLeaveFormUser();

    renderCalendar();
    updateApprovalList(); // 如果有需要審核的，更新審核列表
}

// ========== 審核管理 ==========
function updateApprovalList() {
    const userRole = document.getElementById('userRole').value;
    const approvalList = document.getElementById('approvalList');

    if (userRole !== 'manager') {
        approvalList.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">請切換至主管身分以查看需要核准的請假申請</p>';
        return;
    }

    const records = getLeaveRecords();
    const pendingRecords = records.filter(r => r.status === 'pending');

    if (pendingRecords.length === 0) {
        approvalList.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">目前沒有需要審核的請假申請<br><small>（只有代理人有請假衝突時才需要主管核准）</small></p>';
        return;
    }

    let html = '<div style="margin-bottom:20px;padding:15px;background:#fff3cd;border-left:4px solid #ffc107;"><strong>說明：</strong>以下申請因代理人在同時段也有請假，需要您的特別核准。</div>';
    pendingRecords.forEach(record => {
        const employee = getEmployeeById(record.employeeId);
        const proxy = employee ? getEmployeeById(employee.proxyId) : null;

        html += `<div class="approval-item">`;
        html += `<h3>${record.employeeName} 的請假申請</h3>`;
        html += `<div class="approval-details">`;
        html += `<p><strong>日期：</strong>${record.date}</p>`;
        html += `<p><strong>時間：</strong>${record.startTime} - ${record.endTime}</p>`;
        html += `<p><strong>代理人：</strong>${proxy ? proxy.name : '未設定'}</p>`;
        html += `<p><strong>原因：</strong>${record.reason}</p>`;
        if (record.needsSpecialApproval) {
            html += `<p style="color:#d63031;"><strong>⚠️ 代理人 ${proxy ? proxy.name : ''} 在此時段也有請假</strong></p>`;
        }
        html += `</div>`;
        html += `<div class="approval-actions">`;
        html += `<button class="btn-success" onclick="approveLeave('${record.id}')">核准</button>`;
        html += `<button class="btn-danger" onclick="rejectLeave('${record.id}')">拒絕</button>`;
        html += `</div>`;
        html += `</div>`;
    });

    approvalList.innerHTML = html;
}

function approveLeave(recordId) {
    const records = getLeaveRecords();
    const record = records.find(r => r.id === recordId);

    if (record) {
        record.status = 'approved';
        saveLeaveRecords(records);
        alert('已核准請假申請');
        updateApprovalList();
        renderCalendar();
    }
}

function rejectLeave(recordId) {
    const reason = prompt('請輸入拒絕原因：');
    if (!reason) return;

    const records = getLeaveRecords();
    const record = records.find(r => r.id === recordId);

    if (record) {
        record.status = 'rejected';
        record.rejectReason = reason;
        saveLeaveRecords(records);
        alert('已拒絕請假申請');
        updateApprovalList();
        renderCalendar();
    }
}

// ========== 人員設定管理 ==========
function updateEmployeeList() {
    const employees = getEmployees();
    const employeeList = document.getElementById('employeeList');

    let html = '';
    employees.forEach(emp => {
        const proxy = getEmployeeById(emp.proxyId);

        html += `<div class="employee-item">`;
        html += `<div class="employee-info">`;
        html += `<h3>${emp.name} (${emp.id})</h3>`;
        html += `<p>第一代理人: ${proxy ? proxy.name : '未設定'}</p>`;
        html += `</div>`;
        html += `<div class="employee-actions">`;
        html += `<button class="btn-primary" onclick="editEmployee('${emp.id}')">編輯</button>`;
        html += `</div>`;
        html += `</div>`;
    });

    employeeList.innerHTML = html;
}

function editEmployee(employeeId) {
    const employee = getEmployeeById(employeeId);
    if (!employee) return;

    const employees = getEmployees();
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');

    let html = '<h2>編輯員工資料</h2>';
    html += '<form id="editEmployeeForm">';
    html += `<div class="form-group">`;
    html += `<label>員工ID：</label>`;
    html += `<input type="text" value="${employee.id}" readonly>`;
    html += `</div>`;
    html += `<div class="form-group">`;
    html += `<label>姓名：</label>`;
    html += `<input type="text" id="editName" value="${employee.name}" required>`;
    html += `</div>`;
    html += `<div class="form-group">`;
    html += `<label>第一代理人：</label>`;
    html += `<select id="editProxy">`;
    employees.forEach(emp => {
        if (emp.id !== employee.id) {
            const selected = emp.id === employee.proxyId ? 'selected' : '';
            html += `<option value="${emp.id}" ${selected}>${emp.name}</option>`;
        }
    });
    html += `</select>`;
    html += `</div>`;
    html += `<div class="form-actions">`;
    html += `<button type="submit" class="btn-primary">儲存</button>`;
    html += `<button type="button" class="btn-secondary" onclick="document.getElementById('modal').style.display='none'">取消</button>`;
    html += `</div>`;
    html += '</form>';

    modalBody.innerHTML = html;
    modal.style.display = 'block';

    document.getElementById('editEmployeeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const newName = document.getElementById('editName').value;
        const newProxyId = document.getElementById('editProxy').value;

        employee.name = newName;
        employee.proxyId = newProxyId;

        saveEmployees(employees);
        alert('員工資料已更新');
        modal.style.display = 'none';
        updateEmployeeList();
        setupUserSelector();
        renderCalendar();
    });
}

function addEmployee() {
    alert('新增員工功能：請在編輯現有員工的基礎上擴展。目前系統預設10位員工。');
}

// ========== 初始化應用程式 ==========
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
});
