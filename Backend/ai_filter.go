package main

import (
	"context"
	"fmt"
	"log"
)

// ModerateComment uses AI to detect if a comment is hurtful or contains profanity.
func ModerateComment(diaryContent, commentContent string) (bool, string, error) {
	ctx := context.Background()

	prompt := fmt.Sprintf(`คุณคือครูแนะแนวที่ใจดีและเป็นกลาง หน้าที่ของคุณคือตรวจสอบว่า "ความคิดเห็น" นี้เหมาะสมที่จะโพสต์ใต้ "บันทึกประจำวัน" ของผู้อื่นหรือไม่

📝 เนื้อหาบันทึกประจำวัน:
"%s"

💬 ความคิดเห็นที่ต้องการโพสต์:
"%s"

⚠️ กฎการตรวจสอบ:
1. หากมีความคิดเห็นที่มีคำหยาบคาย (Profanity) -> ไม่อนุญาต
2. หากมีความคิดเห็นที่ "เสียดสี", "ซ้ำเติม", "บูลลี่" หรือ "ทำให้เจ้าของบันทึกเสียใจ" (Hurtful/Negative) -> ไม่อนุญาต
3. หากเป็นคำแนะนำที่รุนแรง หรือทำให้ผู้อื่นรู้สึกแย่ -> ไม่อนุญาต
4. หากเป็นการให้กำลังใจ หรือความเห็นที่สร้างสรรค์ -> อนุญาต

ตอบกลับเป็น JSON รูปแบบนี้:
{
  "allowed": true/false,
  "reason": "เหตุผลสั้นๆ (ภาษาไทย) กรณีที่ไม่อนุญาต ถ้าอนุญาตให้ใส่ empty string"
}`, diaryContent, commentContent)

	resultText, err := generateContent(ctx, prompt)
	if err != nil {
		log.Printf("AI Moderation error: %v", err)
		return true, "", nil // Fallback to allow if AI fails (or you might want to block)
	}

	// Parsing the boolean from JSON-ish text because Gemini might add markdown
	// For simplicity in this script, we'll do basic string detection if not strictly JSON
	var allowed bool
	var reason string

	// Simple extraction if AI doesn't return perfect JSON
	if contains(resultText, `"allowed": true`) {
		allowed = true
	} else if contains(resultText, `"allowed": false`) {
		allowed = false
		// Try to extract reason
		reason = "ไม่ผ่านการตรวจสอบความเหมาะสม"
	} else {
		allowed = true // Fallback
	}

	return allowed, reason, nil
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || (len(substr) > 0 && (func() bool {
		for i := 0; i < len(s)-len(substr)+1; i++ {
			if s[i:i+len(substr)] == substr {
				return true
			}
		}
		return false
	})()))
}
