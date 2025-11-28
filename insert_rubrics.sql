-- 플랫폼 루브릭 10개를 resource_posts 테이블에 삽입

-- 1. 표준 논술 루브릭 (4개 기준)
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', '표준 논술 루브릭 (4개 기준)', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">표준 논술 루브릭 (4개 기준)</h2>
  <p class="mb-6 text-gray-700">일반적인 논술 평가에 사용되는 기본 루브릭입니다.</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 핵심 개념의 이해와 분석</h3>
      <p class="text-gray-700">주요 주제를 정확하게 파악하고 깊이 있게 분석했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 증거와 사례 활용</h3>
      <p class="text-gray-700">논거를 뒷받침하기 위해 구체적이고 적절한 사례를 사용했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 출처 인용의 정확성</h3>
      <p class="text-gray-700">참고 자료에서 정보를 정확하게 인용했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 문법 정확성, 구성 및 흐름</h3>
      <p class="text-gray-700">최소한의 문법 오류, 논리적 흐름, 다양한 문장 구조를 보여줍니다.</p>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 2. 상세 논술 루브릭 (6개 기준)
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', '상세 논술 루브릭 (6개 기준)', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">상세 논술 루브릭 (6개 기준)</h2>
  <p class="mb-6 text-gray-700">보다 세밀한 평가가 필요한 논술 과제에 사용되는 루브릭입니다.</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 주제 이해도</h3>
      <p class="text-gray-700">논술 주제에 대한 깊이 있는 이해를 보여줍니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 논리적 구성</h3>
      <p class="text-gray-700">논술이 체계적이고 논리적으로 구성되어 있습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 근거 제시</h3>
      <p class="text-gray-700">주장을 뒷받침하는 충분한 근거를 제시했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 비판적 사고</h3>
      <p class="text-gray-700">다양한 관점을 고려하고 비판적으로 사고했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">5. 언어 표현력</h3>
      <p class="text-gray-700">적절하고 풍부한 어휘를 사용하여 표현했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">6. 맞춤법과 문법</h3>
      <p class="text-gray-700">맞춤법과 문법이 정확합니다.</p>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 3. 간단 논술 루브릭 (3개 기준)
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', '간단 논술 루브릭 (3개 기준)', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">간단 논술 루브릭 (3개 기준)</h2>
  <p class="mb-6 text-gray-700">빠른 평가가 필요한 짧은 논술 과제에 사용되는 루브릭입니다.</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 내용 충실성</h3>
      <p class="text-gray-700">논술 주제에 맞는 내용을 충실히 작성했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 논리성</h3>
      <p class="text-gray-700">논리적으로 일관성 있게 작성했습니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 표현력</h3>
      <p class="text-gray-700">생각을 명확하게 표현했습니다.</p>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 4. 뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭 (4개 기준)
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭 (4개 기준)', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭</h2>
  <p class="mb-6 text-gray-700">뉴욕 주 리젠트 시험의 논증적 글쓰기 평가 기준입니다.</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 내용과 분석 (주장 제시)</h3>
      <p class="text-gray-700">구체적인 주장을 제시하고, 자료와 주제를 적절히 분석하며, 반론을 평가합니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 증거 활용 능력</h3>
      <p class="text-gray-700">관련 증거를 활용하여 충분하고 적절한 근거를 제시하며, 표절을 피하고 허용 가능한 인용 형식을 사용합니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 일관성과 구성</h3>
      <p class="text-gray-700">과제에 대한 수용 가능한 집중도를 유지하고, 체계적이고 논리적인 구조로 글을 구성합니다.</p>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 언어 사용과 규칙</h3>
      <p class="text-gray-700">적절한 어휘와 문장 구조를 사용하며, 문법과 맞춤법 규칙을 준수합니다.</p>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 5. 뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭</h2>
  <p class="mb-6 text-gray-700">뉴욕 주 리젠트 시험의 분석적 글쓰기 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 내용 및 분석</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>분석 기준을 명확히 설정하는 논리적인 중심 아이디어와 글쓰기 전략을 제시하고, 저자가 중심 아이디어를 전개하기 위해 글쓰기 전략을 사용한 방식을 깊이 있게 분석합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 증거 활용 능력</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>분석을 뒷받침하기 위해 구체적이고 관련성 있는 증거를 효과적으로 활용하여 아이디어를 명확하고 일관되게 제시합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 일관성, 구성 및 스타일</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>아이디어와 정보를 논리적으로 구성하여 일관되고 연결된 응답을 생성하며, 정확한 언어와 건전한 구조를 사용하여 형식적인 스타일을 확립하고 유지합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 규칙 숙달도</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>표준어 문법, 용법, 구두점, 철자법의 규칙 숙달도가 뛰어나며 오류가 드물게 나타납니다.</p>
      </div>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 6. 뉴욕 주 중학교 논술 루브릭
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', '뉴욕 주 중학교 논술 루브릭', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">뉴욕 주 중학교 논술 루브릭</h2>
  <p class="mb-6 text-gray-700">뉴욕 주 중학교 논술 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 내용 및 분석</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>과제의 목적과 논리적으로 연결되는 방식으로 주제를 설득력 있게 명확히 제시하며, 텍스트에 대한 통찰력 있는 분석을 보여줍니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 증거 활용 능력</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>주제와 관련된 잘 선택된 사실, 정의, 구체적인 세부 사항, 인용문 또는 텍스트의 다른 정보와 예시를 활용하여 주제를 전개하며, 다양하고 관련성 있는 증거를 지속적으로 사용합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 일관성, 구성 및 문체</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>적절한 다양한 전환을 능숙하게 사용하여 통일된 전체를 만들고 의미를 강화하는 명확한 구성을 보여주며, 학년에 적합하고 문체적으로 정교한 언어를 사용하여 뚜렷한 어조를 유지하고 형식적인 문체를 확립합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 규칙 준수</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>학년 수준에 맞는 규칙 숙달도를 보여주며 오류가 거의 없습니다.</p>
      </div>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 7. 뉴욕 주 초등학교 논술 루브릭
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', '뉴욕 주 초등학교 논술 루브릭', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">뉴욕 주 초등학교 논술 루브릭</h2>
  <p class="mb-6 text-gray-700">뉴욕 주 초등학교 논술 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 내용 및 분석</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>과제와 목적에 논리적으로 부합하는 방식으로 주제를 명확히 제시하며, 텍스트에 대한 통찰력 있는 이해와 분석을 보여줍니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 증거 활용 능력</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>텍스트에서 관련성 있고 잘 선택된 사실, 정의, 구체적 세부사항, 인용문 또는 기타 정보와 예시를 활용하여 주제를 전개하며, 다양하고 관련성 있는 증거의 사용을 지속합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 일관성, 구성 및 문체</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>명확하고 목적에 부합하는 구성을 보여주며, 학년 수준에 맞는 단어와 구문을 사용하여 아이디어를 능숙하게 연결하고, 학년 수준에 맞는 문체적으로 정교한 언어와 분야별 전문 용어를 사용합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 규칙 준수</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>학년 수준에 맞는 규칙 숙달도를 보여주며 오류가 거의 없습니다.</p>
      </div>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 8. IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', 'IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭</h2>
  <p class="mb-6 text-gray-700">IB MYP 고등학교 개인과 사회 과목의 논술 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 지식과 이해</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>과학적 지식을 개괄적으로 설명하고, 익숙한 상황과 익숙하지 않은 상황 모두에서 문제 해결 및 해결책을 제안하며, 정보를 해석하여 과학적으로 뒷받침되는 판단을 내릴 수 있습니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 조사</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>검증 가능한 문제를 개요로 제시하고, 과학적 추론을 사용하여 예측을 제시하며, 충분하고 관련성 있는 데이터를 수집하는 방법과 변수 조작 방법을 개요로 제시하고, 논리적이고 완전하며 안전한 방법을 설계할 수 있습니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 의사 소통</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>항상 명확하고 적절한 방식으로 정보와 아이디어를 전달하며, 명확하고 논리적인 구조로 효과적으로 구성하고, 적절한 관례를 사용하여 정보 출처를 일관되게 제시합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 비판적 사고</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>다양한 정보를 철저히 분석하고, 서로 다른 관점과 그 함의를 평가하며, 논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시할 수 있습니다.</p>
      </div>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 9. IB 중등 프로그램 중학교 개인과 사회 논술 루브릭
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', 'IB 중등 프로그램 중학교 개인과 사회 논술 루브릭', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">IB 중등 프로그램 중학교 개인과 사회 논술 루브릭</h2>
  <p class="mb-6 text-gray-700">IB MYP 중학교 개인과 사회 과목의 논술 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 지식과 이해</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>과학적 지식을 개괄적으로 설명하고, 익숙한 상황과 익숙하지 않은 상황 모두에서 문제 해결 및 해결책을 제안하며, 정보를 해석하여 과학적으로 뒷받침되는 판단을 내릴 수 있습니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 조사</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>검증 가능한 문제를 개요로 제시하고, 과학적 추론을 사용하여 예측을 제시하며, 충분하고 관련성 있는 데이터를 수집하는 방법과 변수 조작 방법을 개요로 제시하고, 논리적이고 완전하며 안전한 방법을 설계할 수 있습니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 의사 소통</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>항상 명확하고 적절한 방식으로 정보와 아이디어를 전달하며, 명확하고 논리적인 구조로 효과적으로 구성하고, 적절한 관례를 사용하여 정보 출처를 일관되게 제시합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 비판적 사고</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>다양한 정보를 철저히 분석하고, 서로 다른 관점과 그 함의를 평가하며, 논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시할 수 있습니다.</p>
      </div>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');

-- 10. IB 중등 프로그램 과학 논술 루브릭
INSERT INTO resource_posts (category, title, content, author)
VALUES ('rubric', 'IB 중등 프로그램 과학 논술 루브릭', '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">IB 중등 프로그램 과학 논술 루브릭</h2>
  <p class="mb-6 text-gray-700">IB MYP 과학 과목의 논술 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 지식과 이해</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>과학적 지식을 개괄적으로 설명하고, 익숙한 상황과 익숙하지 않은 상황 모두에서 문제 해결 및 해결책을 제안하며, 정보를 해석하여 과학적으로 뒷받침되는 판단을 내릴 수 있습니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 탐구 및 설계</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>검증 가능한 문제를 개요로 제시하고, 과학적 추론을 사용하여 예측을 제시하며, 충분하고 관련성 있는 데이터를 수집하는 방법과 변수 조작 방법을 개요로 제시하고, 논리적이고 완전하며 안전한 방법을 설계할 수 있습니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 의사 소통</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>항상 명확하고 적절한 방식으로 정보와 아이디어를 전달하며, 명확하고 논리적인 구조로 효과적으로 구성하고, 적절한 관례를 사용하여 정보 출처를 일관되게 제시합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 비판적 사고</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>다양한 정보를 철저히 분석하고, 서로 다른 관점과 그 함의를 평가하며, 논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시할 수 있습니다.</p>
      </div>
    </div>
  </div>
</div>
', 'AI 논술 평가 시스템');
