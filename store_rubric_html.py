#!/usr/bin/env python3
"""
Store rubric HTML content in database
"""
import os
import sqlite3

def store_html_in_db():
    """Store HTML files in database"""
    db_path = '/home/user/webapp-ai/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/cf2ac8e8ba456c4158ad9fb80bd0ead345586c0b0c0e5c5dd08455e6fd674e97.sqlite'
    html_dir = '/home/user/webapp-ai/public/rubric-docs'
    
    # File mapping
    file_map = {
        10: '뉴욕 주 리젠트 시험 논증적 글쓰기 루브릭.html',
        11: '뉴욕 주 리젠트 시험 분석적 글쓰기 루브릭.html',
        12: '뉴욕 주 중학교 논술 루브릭.html',
        13: '뉴욕 주 초등학교 논술 루브릭.html',
        14: 'IB 중등 프로그램 고등학교 개인과 사회 논술 루브릭.html',
        15: 'IB 중등 프로그램 중학교 개인과 사회 논술 루브릭.html',
        16: 'IB 중등 프로그램 과학 논술 루브릭.html',
    }
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    for post_id, filename in file_map.items():
        filepath = os.path.join(html_dir, filename)
        
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Update content field with HTML
            cursor.execute(
                'UPDATE resource_posts SET content = ? WHERE id = ?',
                (html_content, post_id)
            )
            print(f"Updated ID {post_id}: {filename}")
        else:
            print(f"File not found: {filename}")
    
    conn.commit()
    conn.close()
    print("\nAll HTML content stored in database!")

if __name__ == '__main__':
    store_html_in_db()
