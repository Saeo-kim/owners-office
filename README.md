# OWNER'S OFFICE

개인 사업체 대표자의 관점에서 재무, 업무, 자원, 제품·서비스, 사업 프로젝트를 하나의 경영 시스템으로 관리하는 웹 애플리케이션입니다.

사용 중인 기기, 구독, 서비스를 **직원**으로 등록하고 월 유지비를 **급여**로 관리합니다. 매출, 목표, 시간 기록을 실제 기록으로 검증하고, 자동 감사가 근거와 출처를 붙여 위험을 보고합니다.

## 실행

Node.js 22.13 이상이 필요합니다. 런타임 의존성은 없습니다.

```powershell
npm start
```

<http://localhost:4320>을 엽니다. 첫 실행 때 **DEMO** 표시가 붙은 데모 데이터가 추가됩니다. 설정 화면이나 상단 배너에서 한 번에 삭제할 수 있고, 삭제한 뒤에는 다시 생기지 않습니다.

| 환경 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `4320` | 포트 |
| `OFFICE_DB` | `data/office.db` | SQLite 파일 위치 |
| `OFFICE_SEED` | `1` | `0`이면 첫 실행 때 데모 데이터를 넣지 않음 |

서버는 `127.0.0.1`에서만 열리고 로컬 호스트로 온 요청에만 응답합니다. 로그인 기능이 없으므로 외부에 공개하지 마세요.

## 두 가지 실행 모드

| | 로컬 모드 (`npm start`) | 웹 모드 (GitHub Pages) |
| --- | --- | --- |
| 저장소 | `data/office.db` (node:sqlite) | 브라우저 IndexedDB (sql.js, WebAssembly SQLite) |
| 데이터 전송 | 이 PC 안에서만 | 서버로 전송하지 않음 |
| 백업 | 파일 복사 또는 설정 > 백업 | 설정 > 백업 파일 내려받기 |

두 모드는 같은 스키마, 검증, 계산, 감사 코드(`src/core/`)를 실행합니다. 테스트에서 두 엔진의 결과가 같은지 확인합니다.

## 기능

| 메뉴 | 내용 |
| --- | --- |
| **Executive Dashboard** | 총자산, 사용 가능 자금, 사업 매출, 사업 순이익, 매출 외 수입, 지출, 제품·서비스 고정 유지비, 인건비, 자금 소진 예상, 12개월 수입·지출 차트, 진행 프로젝트, 목표 달성 현황, 경영 위험 알림 |
| **Finance** | 수입·지출 CRUD와 필터, 고정비/변동비, 사업/개인 비용, 수입 유형(사업 매출·지원금·생활비 지원·기타 개인 수입), 월별 현금흐름, 사업별 손익, 계좌·자산, 재무 목표 대비 실적 |
| **Employees** | 제품·서비스 직원 등록, 부서·직무·담당 업무, 월 유지비(급여)와 기기 감가, 사용 빈도, 업무 기여도, 주관적 만족도와 경제적 효용(분리), 중복 업무 그룹, 유지/개선/해지 검토 상태, 자동 판정 |
| **Ventures** | 프로젝트 CRUD, 수익화 단계, 투자 비용, 투입 시간, 실제 매출, 예상 매출(근거·신뢰도와 함께 별도 표시), 프로젝트별 성과 비교 |
| **Strategy & Goals** | 월간·연간 목표, 지표 6종, 실행 계획 CRUD, 목표·계획·예상·실제 비교, 달성 가능성(선형 추정), 남은 기간에 필요한 일일 페이스 |
| **Productivity** | 업무 기록 CRUD, 실제 작업 시간, 결과물, 기간별 시간, 결과물 기록률, 시간당 매출, 업무 유형·프로젝트별 분석 |
| **Audit & Review** | 목표 미달, 근거 없는 매출 예측, 과도한 동시 진행·정체 프로젝트, 불필요한 유지비, 업무 중복, 시간 낭비, 재무 위험, 만족도와 효용의 차이, 데이터 부족. 모든 항목에 근거 수치, 출처, 권고 표시 |
| **Settings & Data** | 데모 포함/제외, 데모 삭제·재생성, 동시 진행 한도, 시간 가치, JSON 백업과 복원 |

## 경영 원칙: 코드에서 지키는 방법

| 원칙 | 구현 |
| --- | --- |
| 목표·계획·예상·실제 구분 | 별도 컬럼·테이블에 저장하고, 화면에는 각각 다른 배지(목표/계획/예상/실제)로 표시. 서로 더하지 않음 |
| 예상 매출을 실제로 계산하지 않음 | `ventures.expected_monthly_revenue`는 어떤 합계에도 들어가지 않음 (테스트로 확인) |
| 매출과 기타 수입 구분 | `income_type = business_revenue`만 매출. 지원금·생활비 지원·기타 개인 수입은 따로 집계 |
| 매출과 순이익 구분 | 사업 순이익 = 사업 매출 − 사업 비용. 개인 비용과 매출 외 수입은 제외 |
| 만족도와 경제적 효용 분리 | `satisfaction`과 `monthly_value`를 따로 저장. 서로 다르면 감사에서 보고 |
| 데이터가 없으면 추정하지 않음 | 결과를 `null`이나 `no_data`로 두고 화면에 '데이터 없음'을 표시. 감사는 '데이터 부족'으로 보고 |
| 근거와 출처 표시 | KPI, 목표, 감사 항목마다 계산식과 원천 데이터(테이블, 건수, 기간)를 표시 |
| 실제 데이터와 데모 데이터 구분 | 모든 행에 `is_demo`. 사용자가 입력한 행은 항상 실제 데이터. DEMO 배지, 배너, 분석 제외 토글, 일괄 삭제 제공 |
| 인건비와 유지비 분리 | 비용 분류 `labor`(인건비)와 `product_service`(제품·서비스 유지비)를 따로 집계 |

## AI 팀원 API (CFO)

OWNER'S OFFICE는 FOCUS FLOW의 AI 팀원 **CFO**로 동작할 수 있습니다. FOCUS FLOW가 업무를 보내면 이 앱이 계산해 보고서를 돌려줍니다. 두 앱은 DB를 공유하지 않습니다.

| 환경 변수 | 설명 |
| --- | --- |
| `OFFICE_AGENT_TOKEN` | 32자 이상의 임의 문자열. **비우면 API가 꺼져 있고 `/api/agent/*`는 404** |

```powershell
$env:OFFICE_AGENT_TOKEN = "<32자 이상 임의 문자열>"
npm start
```

FOCUS FLOW에도 같은 값을 넣습니다 (`application-local.properties`, 저장소에 올라가지 않음). 토큰은 `Authorization: Bearer` 헤더로만 전달되며 상수 시간으로 비교합니다.

| 메서드·경로 | 설명 |
| --- | --- |
| `GET /api/agent/health` | 상태와 업무 유형 목록 |
| `POST /api/agent/tasks` | 업무 접수. `{ external_ref, title, instructions?, kind?, requested_by? }`. 같은 `external_ref`를 다시 보내면 새로 만들지 않고 기존 항목을 돌려줍니다 (재시도 안전) |
| `GET /api/agent/tasks?external_ref=&status=` | 업무 목록 (최근순) |
| `GET /api/agent/tasks/{id}` | 업무 한 건, 상태 변화 이력(`events`), 결과 |

업무 상태는 `queued → in_progress → completed | failed`입니다. 접수된 업무는 5초 안에 처리됩니다.

| `kind` | 내용 |
| --- | --- |
| `monthly_report` | 월간 재무 보고서 (기본값) |
| `financial_analysis` | 최근 3개월 사업 손익, 프로젝트별 손익 |
| `cash_flow` | 가용자금, 평균 순현금흐름, 자금 소진 예상 |
| `bookkeeping` | 장부 정리 현황 (사업 미연결 거래, 설명 없는 거래, 오래된 잔액) |
| `tax_summary` | 세무 준비 자료 (신고 대행 아님, 세무사 검토 필요) |
| `portfolio` | 투자 자산 합계 (계좌 단위 입력 잔액, 시세 조회 없음) |
| `planning` | 자금 소진 예상, 목표 달성 현황과 권고 |
| `risk_audit` | 감사 규칙의 높음·보통 위험 항목 |

`kind`를 비우면 제목과 지시 내용의 키워드로 고릅니다 (예: "세금" → `tax_summary`). 기간은 현재 월입니다.

**보고서에 담기는 것**: 집계 수치, 감사 항목, 권고, 한계(`limitations`). 계좌 이름, 계좌 메모, 거래 설명과 원장 행은 포함하지 않습니다. 데이터가 없으면 추정하지 않고 `null`과 한계 문구를 씁니다. 데모 데이터가 섞였는지는 `includes_demo`로 알 수 있습니다.

```bash
curl -s -X POST http://127.0.0.1:4320/api/agent/tasks \
  -H "Authorization: Bearer $OFFICE_AGENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"external_ref":"demo-1","title":"11월 월간 보고서"}'
```

## 테스트

```powershell
npm test               # 단위·API·HTTP·AI 팀원 API 테스트 43개, node:sqlite와 sql.js 결과 비교 포함
npm run check          # 모든 JS 문법과 import 경로 확인
npm run test:e2e       # 설치된 Edge/Chrome으로 데스크톱·375px 화면 전체와 CRUD 흐름 확인
npm run test:e2e:pages # Pages 빌드(웹 모드)로 같은 브라우저 테스트
```

## 배포

`main`에 push하면 GitHub Actions가 테스트를 실행한 뒤 `npm run build:pages`의 결과(`dist/`)를 GitHub Pages에 배포합니다.

## 구조

```text
src/core/          브라우저와 Node가 함께 쓰는 코드
  enums.js         부서, 수입 유형, 비용 분류 등 용어
  resources.js     레코드별 필드 정의 (검증과 입력 폼이 모두 이 정의를 사용)
  schema.js        버전별 마이그레이션
  repository.js    검증, CRUD, 설정, 데모 삭제, 백업/복원
  analytics.js     재무, 직원, 사업, 목표, 생산성 계산 (순수 함수)
  audit.js         감사 규칙
  api.js           전송 방식과 무관한 API 라우터
  seed.js          데모 데이터
  sqljs-adapter.js 브라우저용 SQLite 어댑터
server/            node:http 서버와 node:sqlite 어댑터
public/            UI (Vanilla JS, 해시 라우터, SVG 차트)
scripts/           Pages 빌드, 문법 확인
tests/             단위·HTTP 테스트, e2e/ 브라우저 테스트
```

## 라이선스

MIT. 웹 모드는 [sql.js](https://github.com/sql-js/sql.js)(MIT)를 포함합니다.
