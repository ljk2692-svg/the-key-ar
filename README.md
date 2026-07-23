# THE KEY AR — Technical Spike 0

모바일 브라우저에서 평면 이미지 타깃을 인식하고 타깃 위에 `742` 보안 오버레이를 표시하는 WebAR 기술 검증 프로젝트입니다.

## 공개 실행 주소

GitHub Pages 활성화 후:

- AR 실행: `https://ljk2692-svg.github.io/the-key-ar/`
- 테스트 타깃: `https://ljk2692-svg.github.io/the-key-ar/target.html`

## 사용 기술

- A-Frame 1.5.0
- MindAR Image Tracking 1.2.5
- HTML / CSS / JavaScript
- GitHub Pages 정적 HTTPS 호스팅

Spike 0에서는 카메라와 이미지 추적 자체를 빠르게 검증하기 위해 MindAR 공식 테스트 카드와 공식 `.mind` 파일을 사용합니다. 이 단계가 성공하면 실제 THE KEY 전용 이미지 타깃으로 교체합니다.

## 모바일 테스트

1. AR 실행 주소를 Android Chrome 또는 iPhone Safari에서 직접 엽니다.
2. `AR 테스트 시작`을 누르고 카메라 권한을 허용합니다.
3. 테스트 타깃 주소를 PC나 다른 기기에 띄웁니다.
4. 휴대전화로 타깃을 비추면 보안 프레임과 `742`가 나타납니다.

## 주의

- 다운로드한 HTML을 `content://` 또는 `file://`로 열면 카메라가 실행되지 않습니다.
- 카카오톡·인스타그램 내부 브라우저보다 Chrome 또는 Safari 직접 실행을 권장합니다.
- 이 단계에는 로그인, 팀 코드, 데이터베이스, 관리자 기능이 포함되지 않습니다.
