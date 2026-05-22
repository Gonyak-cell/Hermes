# KakaoTalk and Outlook Intake

이 harness는 Teams/Slack이 아니라 **카카오톡 + Outlook 이메일**을 첫 pilot 원천으로 쓸 수 있습니다.

## 권장 흐름

1. 실제 사건 하나를 고릅니다.
2. 사건명, 의뢰인명, 상대방명, 개인명은 가능하면 가명 처리합니다.
3. 카카오톡 대화는 텍스트로 내보냅니다.
4. Outlook 이메일은 `.eml` 파일 또는 JSON export로 준비합니다.
5. 아래 명령으로 task, deadline, document, pending question 후보를 뽑습니다.
6. 변호사 또는 담당자가 후보를 approve/edit/reject합니다.

## 카카오톡

카카오톡 대화방에서 대화 내보내기를 한 뒤 `.txt` 파일을 사용합니다. 모바일/데스크톱 export 포맷이 조금씩 달라도 다음 형태를 지원합니다.

```text
--------------- 2026년 5월 22일 금요일 ---------------
[Partner Kim] [오전 9:12] 내일까지 SPA 수정해서 보내 주세요.
```

실행:

```bash
cd /Users/jws/Documents/Codex/Hermes
npm run intake:kakao
```

직접 파일을 지정하려면:

```bash
node scripts/intake-kakao.mjs examples/project-alpha-matter.json /path/to/kakaotalk-export.txt --source-id kakao-alpha
```

후보를 matter draft에 합치려면:

```bash
node scripts/intake-kakao.mjs examples/project-alpha-matter.json /path/to/kakaotalk-export.txt --write tmp/alpha-with-kakao.json
```

## Outlook 이메일

초기 pilot에서는 Outlook API를 바로 붙이기보다 `.eml` 파일 저장 또는 JSON export를 권장합니다.

지원 입력:

- 단일 `.eml`
- `.eml` 여러 개가 들어 있는 폴더
- Microsoft Graph 스타일 JSON 배열

실행:

```bash
cd /Users/jws/Documents/Codex/Hermes
npm run intake:outlook
```

직접 파일을 지정하려면:

```bash
node scripts/intake-outlook.mjs examples/project-alpha-matter.json /path/to/email.eml --source-id outlook-alpha
```

폴더를 지정하려면:

```bash
node scripts/intake-outlook.mjs examples/project-alpha-matter.json /path/to/outlook-folder --source-id outlook-alpha
```

## Outlook을 자동 연동하려면

자동 연동은 다음 단계입니다.

- Microsoft Graph 권한 설계
- matter별 mailbox/folder mapping
- 읽기 전용 ingestion
- 첨부파일 처리 정책
- privileged/confidential filtering
- 감사로그

실제 로펌 데이터에서는 자동 연동 전에 보안팀/파트너 승인과 client AI consent를 먼저 확정하는 것이 좋습니다.

## 주의사항

- 카카오톡/이메일 원문은 민감도가 높습니다.
- 처음에는 10~30개 메시지만 가명 처리해서 테스트하세요.
- 이 파서는 후보를 뽑는 도구입니다. 확정 업무, 법률 판단, 고객 발송문은 사람이 검토해야 합니다.
