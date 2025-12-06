-- Simplify IB and NY rubrics with docx download links

-- 1. IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭 (ID: 14)
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
        <ul class="list-disc list-inside space-y-1">
          <li>처음부터 끝까지 관련 어휘를 다양하고 정확하게 사용한다.</li>
          <li>철저하고 정확한 설명, 해설 및 예시를 통해 내용과 개념에 대한 상세한 지식과 이해를 보여준다.</li>
        </ul>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 조사</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>명확하고 집중된 연구 질문을 구성/선택하고 그 관련성을 정당화한다.</li>
          <li>포괄적인 실행 계획을 수립하고 효과적으로 따른다.</li>
          <li>적절하고 다양한 관련 정보를 수집하고 기록하는 방법을 사용한다.</li>
          <li>조사 과정과 결과를 철저히 평가한다.</li>
        </ul>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 의사 소통</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>항상 명확하고 적절한 방식으로 정보와 아이디어를 전달한다.</li>
          <li>명확하고 논리적인 구조로 효과적으로 정보와 아이디어를 구성한다.</li>
          <li>적절한 관례를 사용하여 정보 출처를 일관되게 제시한다.</li>
        </ul>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 비판적 사고</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>다양한 정보를 철저히 분석한다.</li>
          <li>서로 다른 관점과 그 함의를 평가한다.</li>
          <li>논리적으로 잘 구성된 증거로 뒷받침된 의견이나 결론을 제시한다.</li>
        </ul>
      </div>
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">📄 상세 루브릭 문서</h3>
    <p class="text-gray-700 mb-3">전체 평가 기준 (0~4점)을 확인하려면 아래 문서를 다운로드하세요.</p>
    <a href="/rubric-files/IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.docx" 
       download 
       class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      전체 루브릭 다운로드 (.docx)
    </a>
  </div>
</div>
'
WHERE id = 14;

-- 2. IB 중등 프로그램 중학교 개인과 사회 논술 루브릭 (ID: 15)
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
        <ul class="list-disc list-inside space-y-1">
          <li>다양한 용어를 일관되게 정확하게 사용한다.</li>
          <li>발전되고 정확한 설명, 해설 및 예시를 통해 내용과 개념에 대한 상세한 지식과 이해를 보여준다.</li>
        </ul>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">2. 조사</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>명확하고 집중된 연구 질문을 구성/선택하고 그 관련성을 설명한다.</li>
          <li>연구 질문을 조사하기 위한 일관된 실행 계획을 효과적으로 수립하고 따른다.</li>
          <li>적절한 다양한 관련 정보를 수집하고 기록하는 방법을 사용한다.</li>
          <li>교사의 지도하에 연구 과정과 결과에 대한 상세한 평가를 제공한다.</li>
        </ul>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">3. 의사 소통</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>청중과 목적에 완전히 적합한 스타일로 정보와 아이디어를 전달한다.</li>
          <li>과제의 지시에 완전히 따라 정보와 아이디어를 구조화한다.</li>
          <li>완전한 참고문헌 목록을 작성하고 항상 원 자료를 인용한다.</li>
        </ul>
      </div>
    </div>
    
    <div class="criterion-card border border-gray-300 rounded-lg p-4 bg-white">
      <h3 class="text-lg font-semibold text-blue-900 mb-2">4. 비판적 사고</h3>
      <div class="text-gray-700">
        <p class="font-semibold mb-2">4점:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>개념, 쟁점, 모델, 시각적 표현이나 이론에 대한 상세한 분석을 수행한다.</li>
          <li>정보를 요약하여 일관되고 잘 뒷받침된 논증을 제시한다.</li>
          <li>다양한 자료/데이터의 출처와 목적을 효과적으로 분석하며, 그 가치와 한계를 지속적으로 인식한다.</li>
          <li>다양한 관점을 명확히 인식하고 그 함의를 일관되게 설명한다.</li>
        </ul>
      </div>
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">📄 상세 루브릭 문서</h3>
    <p class="text-gray-700 mb-3">전체 평가 기준 (0~4점)을 확인하려면 아래 문서를 다운로드하세요.</p>
    <a href="/rubric-files/IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.docx" 
       download 
       class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      전체 루브릭 다운로드 (.docx)
    </a>
  </div>
</div>
'
WHERE id = 15;

-- 3. IB 중등 프로그램 과학 논술 루브릭 (ID: 16) - Add docx link
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
    <h3 class="text-lg font-semibold text-blue-900 mb-2">📄 상세 루브릭 문서</h3>
    <p class="text-gray-700 mb-3">전체 평가 기준 (0~4점)을 확인하려면 아래 문서를 다운로드하세요.</p>
    <a href="/rubric-files/IB 중등 프로그램 과학 논술 루브릭.docx" 
       download 
       class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      전체 루브릭 다운로드 (.docx)
    </a>
  </div>
</div>
'
WHERE id = 16;

-- 4. 뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭 (ID: 10) - Add docx link
UPDATE resource_posts 
SET content = content || '
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">📄 상세 루브릭 문서</h3>
    <p class="text-gray-700 mb-3">전체 평가 기준을 확인하려면 아래 문서를 다운로드하세요.</p>
    <a href="/rubric-files/뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.docx" 
       download 
       class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      전체 루브릭 다운로드 (.docx)
    </a>
  </div>
</div>
'
WHERE id = 10 AND content NOT LIKE '%상세 루브릭 문서%';

-- 5. 뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭 (ID: 11) - Add docx link
UPDATE resource_posts 
SET content = content || '
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">📄 상세 루브릭 문서</h3>
    <p class="text-gray-700 mb-3">전체 평가 기준을 확인하려면 아래 문서를 다운로드하세요.</p>
    <a href="/rubric-files/뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.docx" 
       download 
       class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      전체 루브릭 다운로드 (.docx)
    </a>
  </div>
</div>
'
WHERE id = 11 AND content NOT LIKE '%상세 루브릭 문서%';

-- 6. 뉴욕 주 중학교 논술 루브릭 (ID: 12) - Add docx link
UPDATE resource_posts 
SET content = content || '
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">📄 상세 루브릭 문서</h3>
    <p class="text-gray-700 mb-3">전체 평가 기준을 확인하려면 아래 문서를 다운로드하세요.</p>
    <a href="/rubric-files/뉴욕 주 중학교 논술 루브릭.docx" 
       download 
       class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      전체 루브릭 다운로드 (.docx)
    </a>
  </div>
</div>
'
WHERE id = 12 AND content NOT LIKE '%상세 루브릭 문서%';

-- 7. 뉴욕 주 초등학교 논술 루브릭 (ID: 13) - Add docx link
UPDATE resource_posts 
SET content = content || '
  
  <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h3 class="text-lg font-semibold text-blue-900 mb-2">📄 상세 루브릭 문서</h3>
    <p class="text-gray-700 mb-3">전체 평가 기준을 확인하려면 아래 문서를 다운로드하세요.</p>
    <a href="/rubric-files/뉴욕 주 초등학교 논술 루브릭.docx" 
       download 
       class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
      </svg>
      전체 루브릭 다운로드 (.docx)
    </a>
  </div>
</div>
'
WHERE id = 13 AND content NOT LIKE '%상세 루브릭 문서%';
