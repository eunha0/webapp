#!/bin/bash

# Update rubric posts with HTML content from files

# Map of post IDs and corresponding HTML files
declare -A rubric_files=(
  [10]="뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.html"
  [11]="뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.html"
  [12]="뉴욕 주 중학교 논술 루브릭.html"
  [13]="뉴욕 주 초등학교 논술 루브릭.html"
  [14]="IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.html"
  [15]="IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.html"
  [16]="IB 중등 프로그램 과학 논술 루브릭.html"
)

HTML_DIR="/home/user/webapp-ai/public/rubric-docs"

for post_id in "${!rubric_files[@]}"; do
  filename="${rubric_files[$post_id]}"
  filepath="$HTML_DIR/$filename"
  
  if [ -f "$filepath" ]; then
    echo "Updating post ID $post_id with $filename..."
    
    # Read HTML content and escape single quotes
    html_content=$(cat "$filepath" | sed "s/'/''/g")
    
    # Update database
    npx wrangler d1 execute webapp-production --local --command="UPDATE resource_posts SET content = '$html_content' WHERE id = $post_id"
    
    echo "✓ Updated post ID $post_id"
  else
    echo "✗ File not found: $filepath"
  fi
done

echo ""
echo "All rubric documents updated!"
