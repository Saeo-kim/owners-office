import { RESOURCES } from '../../core/resources.js';
import { confirmDialog, html, table, toast, won } from '../ui.js';

export async function render({ backend }) {
  const s = await backend.get('/status');
  const rows = Object.entries(s.counts).map(([k, c]) => ({ name: RESOURCES[k].label, real: c.total - c.demo, demo: c.demo }));
  const demoTotal = rows.reduce((n, r) => n + r.demo, 0);

  return {
    title: 'Settings & Data',
    body: html`<div class="cols-2">
      <section class="card section">
        <div class="card-head"><div><h2>데이터 현황</h2><p>${s.mode === 'cloud' ? '클라우드: Cloudflare Durable Object SQLite (비밀번호로 보호)' : s.mode === 'server' ? '로컬 모드: 이 PC의 SQLite 파일 (data/office.db)' : '웹 모드: 이 브라우저의 IndexedDB (서버 전송 없음)'}</p></div></div>
        ${table([
          { label: '종류', cell: (r) => r.name, primary: true },
          { label: '실제 데이터', cell: (r) => `${r.real}건`, num: true },
          { label: 'DEMO', cell: (r) => `${r.demo}건`, num: true },
        ], rows)}
        <div class="toolbar" style="margin-top:12px">
          ${demoTotal ? html`<button class="danger" data-action="delete-demo">데모 데이터 ${demoTotal}건 삭제</button>
            <button data-action="toggle-demo">${s.settings.include_demo ? '분석에서 데모 제외' : '분석에 데모 포함'}</button>` : html`<button data-action="seed-demo">데모 데이터 다시 넣기</button>`}
        </div>
        <div class="source">데모 데이터는 모든 화면에 DEMO로 표시되며, 직접 등록한 항목은 항상 실제 데이터로 저장됩니다.</div>
      </section>
      <section class="card section">
        <div class="card-head"><h2>경영 기준</h2></div>
        <form id="settings-form" class="grid">
          <div class="field"><label for="s-max">동시 진행 사업 한도</label><input id="s-max" name="max_active_ventures" type="number" min="1" max="20" value="${s.settings.max_active_ventures}"><div class="help">넘으면 감사에서 '과도한 동시 진행'으로 보고합니다.</div></div>
          <div class="field"><label for="s-hour">시간 가치 (원/시간)</label><input id="s-hour" name="hourly_value" type="number" min="0" step="1000" value="${s.settings.hourly_value}"><div class="help">사업별 '시간 비용 반영 손익(추정)'에만 쓰입니다. 현재 ${won(s.settings.hourly_value)}.</div></div>
          <div><button class="primary" type="submit">저장</button></div>
        </form>
      </section>
      <section class="card section">
        <div class="card-head"><div><h2>백업과 복원</h2><p>JSON 파일로 모든 데이터를 내보내고 다시 불러옵니다.</p></div></div>
        <div class="toolbar">
          <button id="export-btn">백업 파일 내려받기</button>
          <label class="btn" for="import-file">백업 파일 불러오기</label>
          <input id="import-file" type="file" accept="application/json,.json" hidden>
        </div>
        <div class="source">불러오기는 현재 데이터를 모두 바꿉니다. 먼저 백업하세요.</div>
      </section>
      <section class="card section">
        <div class="card-head"><div><h2>아이폰 홈 화면에 설치</h2><p>앱처럼 전체 화면으로 실행됩니다.</p></div></div>
        <ol class="small" style="margin:0;padding-left:20px;display:grid;gap:6px">
          <li>아이폰 <strong>Safari</strong>에서 이 주소를 엽니다. (Chrome 등 다른 브라우저는 홈 화면 설치를 지원하지 않습니다.)</li>
          <li>하단의 <strong>공유</strong> 버튼(네모에 위쪽 화살표)을 누릅니다.</li>
          <li><strong>홈 화면에 추가</strong>를 선택하고 이름을 확인한 뒤 <strong>추가</strong>를 누릅니다.</li>
          <li>홈 화면의 OWNER'S OFFICE 아이콘으로 실행합니다. 주소창 없이 열리면 설치된 것입니다.</li>
        </ol>
        <div class="source">주의: 홈 화면 앱과 Safari는 저장 공간이 분리되어 있습니다. 데이터를 옮기려면 Safari에서 백업 파일을 내려받고 홈 화면 앱에서 불러오세요. 데이터는 서버로 전송되지 않고 이 기기에만 저장됩니다.</div>
      </section>
      <section class="card section">
        <div class="card-head"><h2>경영 원칙</h2></div>
        <ul class="small" style="margin:0;padding-left:18px;display:grid;gap:4px">
          <li>목표·계획·예상·실제를 따로 저장하고 각각 다른 표시로 보여줍니다.</li>
          <li>예상 매출은 어떤 실제 합계에도 더하지 않습니다.</li>
          <li>사업 매출만 매출로 계산합니다. 지원금, 생활비 지원, 기타 개인 수입은 따로 집계합니다.</li>
          <li>매출과 순이익(사업 매출 − 사업 비용)을 따로 표시합니다.</li>
          <li>주관적 만족도와 경제적 효용을 따로 평가합니다.</li>
          <li>데이터가 없으면 '데이터 없음'으로 표시하고 추정하지 않습니다.</li>
          <li>분석 수치에는 근거와 데이터 출처를 함께 표시합니다.</li>
        </ul>
      </section>
    </div>`,
  };
}

export function mount(root, { backend }) {
  root.querySelector('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await backend.put('/settings', { max_active_ventures: Number(f.get('max_active_ventures')), hourly_value: Number(f.get('hourly_value')) });
      toast('저장했습니다.');
      window.dispatchEvent(new Event('oo:reload'));
    } catch (err) {
      toast(err.message, true);
    }
  });
  root.querySelector('#export-btn').addEventListener('click', async () => {
    const data = await backend.get('/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `owners-office-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  root.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!(await confirmDialog('현재 데이터를 모두 지우고 백업 파일 내용으로 바꿉니다. 계속할까요?', { okLabel: '불러오기', danger: true }))) {
      e.target.value = '';
      return;
    }
    try {
      const payload = JSON.parse(await file.text());
      const r = await backend.post('/import', payload);
      toast(`${r.imported}건을 불러왔습니다.`);
      window.dispatchEvent(new Event('oo:reload'));
    } catch (err) {
      toast(err.message, true);
    } finally {
      e.target.value = '';
    }
  });
}
