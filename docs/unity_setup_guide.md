# Unity Client Setup & Server Integration Guide

이 가이드는 유니티(Unity) 클라이언트와 Node.js 서버를 연동하여 화면에서 움직임을 확인하기 위한 **최초 설정 단계**를 단계별로 안내합니다.

---

## 1. 필수 패키지 설치
현재 작성된 C# 스크립트는 외부 라이브러리인 **DOTween**과 **Newtonsoft JSON**을 사용하고 있습니다. 컴파일 에러를 방지하고 연출을 재생하기 위해 유니티 프로젝트에 먼저 설치해야 합니다.

### ① Newtonsoft.Json (Json.NET) 설치
1. Unity Editor 상단 메뉴에서 **Window > Package Manager**를 엽니다.
2. Package Manager 창 좌측 상단의 **`+` 버튼**을 누르고 **Add package by name...**을 선택합니다.
3. `com.unity.nuget.newtonsoft-json`을 입력하고 **Add**를 누릅니다.

### ② DOTween 설치
1. **Unity Asset Store**에서 [DOTween (Free)](https://assetstore.unity.com/packages/tools/animation/dotween-free-17639)을 내 에셋에 추가합니다.
2. Package Manager에서 **Packages: My Assets**로 변경한 뒤 `DOTween`을 검색하여 **Download** 및 **Import**합니다.
3. Import 후 나타나는 **DOTween Utility Panel**에서 **Setup DOTween...** 버튼을 눌러 설정을 완료합니다.

---

## 2. 씬(Scene) 오브젝트 구성 및 컴포넌트 연결

### ① 함선 오브젝트 (Target Ship) 생성
서버가 전달해 준 좌표로 이동을 시각적으로 보여줄 함선 오브젝트를 만듭니다.
1. Hierarchy 창에서 우클릭 후 **2D Object > Sprites > Square** (또는 Circle 등 원하는 형태)를 생성합니다.
2. 생성된 오브젝트의 이름을 **`TargetShip`**으로 변경합니다.
3. 인스펙터(Inspector) 창에서 해당 오브젝트의 Scale을 `(1, 1, 1)` 정도로 조정하고 색상을 알아보기 쉬운 색(예: 노란색/파란색)으로 변경합니다.

### ② 매니저 오브젝트 생성 및 스크립트 추가
게임의 네트워크 통신 및 턴 연출을 담당할 매니저 오브젝트들을 생성합니다.

1. Hierarchy 창에서 우클릭 후 **Create Empty**를 눌러 빈 오브젝트를 생성하고 이름을 **`GameManagers`**로 변경합니다.
2. `GameManagers` 아래에 자식 빈 오브젝트들을 다음과 같이 생성합니다:
   * **`NetworkManager`**
   * **`SequenceParser`**
   * **`GameManager`**
3. 각각의 오브젝트에 프로젝트에 작성되어 있는 C# 스크립트를 드래그 앤 드롭으로 추가합니다:
   * `NetworkManager` 오브젝트 ──► [NetworkManager.cs](file:///wsl.localhost/Ubuntu/home/mkang/work/repos/cosmos-odyssey/client/Assets/Scripts/Network/NetworkManager.cs) 추가
   * `SequenceParser` 오브젝트 ──► [SequenceParser.cs](file:///wsl.localhost/Ubuntu/home/mkang/work/repos/cosmos-odyssey/client/Assets/Scripts/Core/SequenceParser.cs) 추가
   * `GameManager` 오브젝트 ──► [GameManager.cs](file:///wsl.localhost/Ubuntu/home/mkang/work/repos/cosmos-odyssey/client/Assets/Scripts/Core/GameManager.cs) 추가

---

## 3. 인스펙터(Inspector) 레퍼런스 연결 (중요)

각 스크립트가 서로를 참조하고 움직일 대상을 알 수 있도록 인스펙터 창에서 레퍼런스를 연결해 주어야 합니다.

### ① GameManager 설정
* Hierarchy 창의 **`GameManager`** 오브젝트를 선택합니다.
* 인스펙터 창의 `GameManager` 컴포넌트 필드에 다음과 같이 드래그 앤 드롭하여 연결합니다:
  * **Network Manager:** Hierarchy 창의 `NetworkManager` 오브젝트를 드래그 앤 드롭
  * **Sequence Parser:** Hierarchy 창의 `SequenceParser` 오브젝트를 드래그 앤 드롭

### ② SequenceParser 설정
* Hierarchy 창의 **`SequenceParser`** 오브젝트를 선택합니다.
* 인스펙터 창의 `Sequence Parser` 컴포넌트 필드에 연결합니다:
  * **Target Ship:** Hierarchy 창의 `TargetShip` 오브젝트를 드래그 앤 드롭

### ③ NetworkManager 설정
* Hierarchy 창의 **`NetworkManager`** 오브젝트를 선택합니다.
* 인스펙터 창의 `Server Url`이 다음과 같이 설정되어 있는지 확인합니다:
  * `http://localhost:3000/api/turn/submit` (로컬 서버 주소)

---

## 4. 연동 테스트 진행 방법

모든 설정이 완료되었다면 다음 순서로 서버와 연동하여 동작을 검증합니다.

1. **로컬 서버가 켜져 있는지 확인합니다.** 
   * (현재 서버가 `http://localhost:3000`에서 백그라운드로 실행 중입니다.)
2. 유니티 에디터에서 **Play (▶) 버튼**을 누릅니다.
3. 게임 뷰(Game View)가 활성화된 상태에서 **`Spacebar` 키**를 누릅니다.
4. **결과 확인:**
   * 유니티 **Console 창**에 서버로부터 수신된 메시지(`[GameManager] 서버 응답 성공!`)가 출력되는지 확인합니다.
   * 화면상의 **`TargetShip` (도형)**이 0초(제자리) ──► 1.2초(x:12, y:15 좌표로 이동) ──► 5초(종료) 흐름에 따라 부드럽게 움직이는지 확인합니다.
