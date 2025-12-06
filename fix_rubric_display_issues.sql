-- Fix rubric display issues:
-- 1. Remove duplicate download sections from NY State rubrics
-- 2. Fix HTML code showing as text in download buttons

-- Strategy: Completely rewrite the download sections for all 7 rubrics
-- This ensures clean HTML without duplicates or text artifacts

-- 1. NY State - 논증적 글쓰기 루브릭 (ID: 10)
UPDATE resource_posts 
SET content = '
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
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-3">📄 상세 평가 기준 문서</h3>
    <p class="text-gray-700 mb-3">모든 점수대의 상세한 평가 기준은 아래 문서를 다운로드하여 확인하실 수 있습니다.</p>
    <a href="/rubric-files/뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.docx" download class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      상세 루브릭 다운로드 (DOCX)
    </a>
  </div>
</div>
'
WHERE id = 10;

-- 2. NY State - 분석적 글쓰기 루브릭 (ID: 11)
UPDATE resource_posts 
SET content = '
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
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-3">📄 상세 평가 기준 문서</h3>
    <p class="text-gray-700 mb-3">모든 점수대의 상세한 평가 기준은 아래 문서를 다운로드하여 확인하실 수 있습니다.</p>
    <a href="/rubric-files/뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.docx" download class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      상세 루브릭 다운로드 (DOCX)
    </a>
  </div>
</div>
'
WHERE id = 11;

-- 3. NY State - 중학교 논술 루브릭 (ID: 12)
UPDATE resource_posts 
SET content = '
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
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-3">📄 상세 평가 기준 문서</h3>
    <p class="text-gray-700 mb-3">모든 점수대의 상세한 평가 기준은 아래 문서를 다운로드하여 확인하실 수 있습니다.</p>
    <a href="/rubric-files/뉴욕 주 중학교 논술 루브릭.docx" download class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      상세 루브릭 다운로드 (DOCX)
    </a>
  </div>
</div>
'
WHERE id = 12;

-- 4. NY State - 초등학교 논술 루브릭 (ID: 13)
UPDATE resource_posts 
SET content = '
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
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-3">📄 상세 평가 기준 문서</h3>
    <p class="text-gray-700 mb-3">모든 점수대의 상세한 평가 기준은 아래 문서를 다운로드하여 확인하실 수 있습니다.</p>
    <a href="/rubric-files/뉴욕 주 초등학교 논술 루브릭.docx" download class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      상세 루브릭 다운로드 (DOCX)
    </a>
  </div>
</div>
'
WHERE id = 13;

-- 5. IB 고등학교 개인과 사회 (ID: 14) - Fix class attribute display
UPDATE resource_posts 
SET content = '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭</h2>
  <p class="mb-6 text-gray-700">IB MYP 고등학교 개인과 사회 과목의 논술 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 지식과 이해</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>처음부터 끝까지 관련 어휘를 다양하고 정확하게 사용하며, 철저하고 정확한 설명·해설·예시를 통해 내용과 개념에 대한 상세한 지식과 이해를 보여줍니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 조사</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>명확하고 집중된 연구 질문을 구성/선택하고 그 관련성을 정당화하며, 포괄적인 실행 계획을 효과적으로 수립·실행하고, 조사 과정과 결과를 철저히 평가합니다.</p>
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
        <p>다양한 정보를 철저히 분석하고, 서로 다른 관점과 그 함의를 평가하며, 논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시합니다.</p>
      </div>
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-3">📄 상세 평가 기준 문서</h3>
    <p class="text-gray-700 mb-3">모든 점수대(0-4점)의 상세한 평가 기준은 아래 문서를 다운로드하여 확인하실 수 있습니다.</p>
    <a href="/rubric-files/IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.docx" download class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      상세 루브릭 다운로드 (DOCX)
    </a>
  </div>
</div>
'
WHERE id = 14;

-- 6. IB 중학교 개인과 사회 (ID: 15) - Fix class attribute display
UPDATE resource_posts 
SET content = '
<div class="rubric-container">
  <h2 class="text-2xl font-bold mb-4">IB 중등 프로그램 중학교 개인과 사회 논술 루브릭</h2>
  <p class="mb-6 text-gray-700">IB MYP 중학교 개인과 사회 과목의 논술 평가 기준입니다. (4점 만점)</p>
  
  <div class="criteria-list space-y-4">
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">1. 지식과 이해</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>다양한 용어를 일관되게 정확하게 사용하며, 발전되고 정확한 설명·해설·예시를 통해 내용과 개념에 대한 상세한 지식과 이해를 보여줍니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 조사</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>명확하고 집중된 연구 질문을 구성/선택하고 그 관련성을 설명하며, 일관된 실행 계획을 효과적으로 수립·실행하고, 교사의 지도하에 연구 과정과 결과에 대한 상세한 평가를 제공합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 의사 소통</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>청중과 목적에 완전히 적합한 스타일로 정보와 아이디어를 전달하며, 과제 지시에 완전히 따라 구조화하고, 완전한 참고문헌 목록을 작성하며 항상 원 자료를 인용합니다.</p>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 비판적 사고</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <p>개념·쟁점·모델·시각적 표현·이론에 대한 상세한 분석을 수행하고, 일관되고 잘 뒷받침된 논증을 제시하며, 다양한 자료의 출처와 목적을 효과적으로 분석하고 다양한 관점을 명확히 인식합니다.</p>
      </div>
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-3">📄 상세 평가 기준 문서</h3>
    <p class="text-gray-700 mb-3">모든 점수대(0-4점)의 상세한 평가 기준은 아래 문서를 다운로드하여 확인하실 수 있습니다.</p>
    <a href="/rubric-files/IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.docx" download class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      상세 루브릭 다운로드 (DOCX)
    </a>
  </div>
</div>
'
WHERE id = 15;

-- 7. IB 과학 (ID: 16) - Fix class attribute display
UPDATE resource_posts 
SET content = '
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
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-3">📄 상세 평가 기준 문서</h3>
    <p class="text-gray-700 mb-3">모든 점수대(0-4점)의 상세한 평가 기준은 아래 문서를 다운로드하여 확인하실 수 있습니다.</p>
    <a href="/rubric-files/IB 중등 프로그램 과학 논술 루브릭.docx" download class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      상세 루브릭 다운로드 (DOCX)
    </a>
  </div>
</div>
'
WHERE id = 16;
