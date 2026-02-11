package main

import (
	"context"
	context2 "context"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"google.golang.org/genai"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"dt-backend/controller/auth"
)

// Gemini API Key
var geminiKeys []string

func loadAPIKeys() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using default key")
	}

	keys := os.Getenv("GEMINI_API_KEYS")
	if keys != "" {
		geminiKeys = strings.Split(keys, ",")
	} else {
		// Fallback
		geminiKeys = []string{"AIzaSyBNcXnIocELgHhnV0VIyq9SZkqfH0wdvxg"}
	}
}

func generateContent(ctx context.Context, prompt string) (string, error) {
	var lastErr error

	for _, key := range geminiKeys {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}

		client, err := genai.NewClient(ctx, &genai.ClientConfig{
			APIKey:  key,
			Backend: genai.BackendGeminiAPI,
		})
		if err != nil {
			lastErr = err
			log.Printf("Failed to create client with key ...%s: %v", key[len(key)-4:], err)
			continue
		}

		result, err := client.Models.GenerateContent(
			ctx,
			"gemini-2.0-flash", // Updated to latest model, or use existing
			genai.Text(prompt),
			nil,
		)
		if err != nil {
			lastErr = err
			log.Printf("Gemini API error with key ...%s: %v", key[len(key)-4:], err)
			continue // Try next key
		}

		return result.Text(), nil
	}

	return "", fmt.Errorf("all API keys failed. Last error: %v", lastErr)
}

// --- Models ---
type DiaryEntry struct {
	ID            uint                `json:"id" gorm:"primaryKey"`
	Username      string              `json:"username"` // Link to auth user
	Title         string              `json:"title"`
	Content       string              `json:"content"`
	Mood          string              `json:"mood"` // Emoji mood when writing
	Reflection    string              `json:"reflection"`
	AIResponse    string              `json:"aiResponse"`
	Status        string              `json:"status"`
	NeedHelpCount int                 `json:"needHelpCount"`
	Preview       string              `json:"preview"`
	IsLocked      bool                `json:"isLocked"`
	UnlockAt      time.Time           `json:"unlockAt"`
	CreatedAt     time.Time           `json:"createdAt"`
	IsPublic      bool                `json:"isPublic"`
	IsAnonymous   bool                `json:"isAnonymous"`
	IsFinished    bool                `json:"isFinished"`
	Reflections   []ReflectionHistory `json:"reflections" gorm:"foreignKey:DiaryEntryID"`
}

type ReflectionHistory struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	DiaryEntryID uint      `json:"diaryEntryId"`
	Content      string    `json:"content"`
	Status       string    `json:"status"`
	AIResponse   string    `json:"aiResponse"`
	CreatedAt    time.Time `json:"createdAt"`
}

// UserPreference stores AI learning data from user Q&A
type UserPreference struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	Question  string    `json:"question"`
	Answer    string    `json:"answer"`
	Category  string    `json:"category"` // emotion, coping, trigger, etc.
	CreatedAt time.Time `json:"createdAt"`
}

var DB *gorm.DB

// Summary cache
var cachedSummary gin.H
var cachedDataHash string

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("diary.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	DB.AutoMigrate(&DiaryEntry{}, &UserPreference{}, &Comment{}, &ReflectionHistory{})
}

// --- Gemini API using official SDK ---
func callGeminiAPI(originalContent, reflection, status string, needHelpCount int) (string, error) {
	ctx := context.Background()

	var statusContext string
	var urgencyNote string

	switch status {
	case "over_it":
		statusContext = "ผู้ใช้บอกว่าเรื่องนี้จบแล้ว ไม่ได้รู้สึกแย่อีกแล้ว (เรื่องจิ๊บจ๊อย)"
	case "still_dealing":
		statusContext = "ผู้ใช้ยังสู้อยู่กับเรื่องนี้ แต่รู้สึกโอเคขึ้นแล้ว"
	case "need_help":
		statusContext = "ผู้ใช้ยังเครียดมากและต้องการความช่วยเหลือ"
		if needHelpCount >= 3 {
			urgencyNote = fmt.Sprintf("\n\n⚠️ สำคัญ: ผู้ใช้เลือก 'ไม่ไหว ช่วยด้วย' มาแล้ว %d ครั้งติดต่อกัน กรุณาแสดงความห่วงใยอย่างจริงจัง แนะนำให้พูดคุยกับคนใกล้ชิดหรือผู้เชี่ยวชาญ และย้ำเตือนสายด่วนสุขภาพจิต 1323", needHelpCount)
		} else if needHelpCount >= 2 {
			urgencyNote = "\n\n⚠️ ผู้ใช้เลือก 'ไม่ไหว ช่วยด้วย' เป็นครั้งที่ 2 แล้ว กรุณาตอบด้วยความเอาใจใส่มากขึ้น"
		}
	}

	prompt := fmt.Sprintf(`คุณคือนักจิตวิทยาที่อบอุ่นและเข้าใจ กำลังช่วยผู้ใช้ที่ไตร่ตรองความรู้สึกของตัวเอง

📝 ข้อความที่เขาเขียนไว้เมื่อวาน (ตอนอารมณ์ร้อน):
"%s"

💭 สิ่งที่เขาเขียนไตร่ตรองวันนี้ (ต้องอ่านและตอบเนื้อหานี้โดยเฉพาะ):
"%s"

📊 สถานะที่เลือก: %s%s

⚠️ สำคัญมาก: 
- ตอบกลับโดยอ้างอิงถึงสิ่งที่เขาเขียนไว้ในส่วน "ไตร่ตรองวันนี้" โดยเฉพาะ
- ถ้าเขาเขียนว่ารู้สึกอย่างไร ให้ตอบรับรู้ความรู้สึกนั้น
- ถ้าเขาเขียนว่าเรียนรู้อะไร ให้ชื่นชมการเรียนรู้นั้น
- อย่าตอบแบบกว้างๆ ทั่วไป ต้องเฉพาะเจาะจงกับสิ่งที่เขาเขียน

🔍 ตรวจจับความขัดแย้ง:
- ถ้าข้อความที่เขียนบอกว่ายังรู้สึกไม่ดี/เครียด/กังวล แต่เลือก "เรื่องจิ๊บจ๊อย" ให้ถามเขาอย่างอ่อนโยนว่า "ดูเหมือนยังมีบางอย่างค้างคาอยู่นะ ไม่เป็นไรถ้ายังไม่โอเค"
- ถ้าข้อความบอกว่าโอเคแล้ว แต่เลือก "ไม่ไหว" ให้ถามว่า "ดูเหมือนคุณแข็งแกร่งขึ้นนะ ต้องการความช่วยเหลือจริงๆ ไหม?"

ตอบกลับ 2-3 ประโยค เป็นภาษาไทย อบอุ่น และเฉพาะเจาะจงกับสิ่งที่เขาเขียน`, originalContent, reflection, statusContext, urgencyNote)

	// Call standardized helper
	return generateContent(ctx, prompt)
}

// --- Controllers ---
func GetEntries(c *gin.Context) {
	username := c.GetString("username")
	var entries []DiaryEntry
	result := DB.Where("username = ? AND is_public = ?", username, false).Order("created_at desc").Find(&entries)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	now := time.Now()
	for i := range entries {
		if now.Before(entries[i].UnlockAt) {
			entries[i].IsLocked = true
			entries[i].Content = ""
			entries[i].Preview = "Locked content..."
		} else {
			entries[i].IsLocked = false
			if len(entries[i].Content) > 50 {
				entries[i].Preview = entries[i].Content[:50] + "..."
			} else {
				entries[i].Preview = entries[i].Content
			}
		}
	}

	c.JSON(http.StatusOK, entries)
}

func CreateEntry(c *gin.Context) {
	var input struct {
		Title       string `json:"title" binding:"required"`
		Content     string `json:"content" binding:"required"`
		Mood        string `json:"mood"`
		IsPublic    bool   `json:"isPublic"`
		IsAnonymous bool   `json:"isAnonymous"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	username := c.GetString("username")
	unlockTime := time.Now().Add(24 * time.Hour)
	// If it's public, it should be available immediately (no lock)
	if input.IsPublic {
		unlockTime = time.Now()
	}

	entry := DiaryEntry{
		Username:    username,
		Title:       input.Title,
		Content:     input.Content,
		Mood:        input.Mood,
		UnlockAt:    unlockTime,
		IsPublic:    input.IsPublic,
		IsAnonymous: input.IsAnonymous,
	}

	result := DB.Create(&entry)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusCreated, entry)
}

func main() {
	loadAPIKeys()
	InitDB()
	auth.InitAuthDB()
	fmt.Println("Database initialized.")

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(config))

	// Public Auth routes
	r.POST("/register", auth.Register)
	r.POST("/login", auth.Login)
	r.GET("/public/entries", GetPublicEntries)
	r.GET("/entries/:id/comments", GetComments)

	// Protected Routes
	protected := r.Group("/")
	protected.Use(auth.AuthMiddleware())
	{
		protected.GET("/entries", GetEntries)
		protected.GET("/entries/:id", GetEntry)
		protected.GET("/summary", GetSummary)
		protected.GET("/ai/prompts", GetAIPrompts)
		protected.GET("/ai/weekly-digest", GetWeeklyDigest)
		protected.GET("/ai/alerts", GetPatternAlerts)
		protected.POST("/entries", CreateEntry)
		protected.POST("/entries/:id/unlock", UnlockEntry)
		protected.POST("/entries/:id/respond", Respond)
		protected.DELETE("/entries/:id", DeleteEntry)

		// User Preferences
		protected.GET("/preferences", GetPreferences)
		protected.POST("/preferences", SavePreference)
		protected.GET("/ai/questions", GetAIQuestions)

		// Profile Routes
		protected.GET("/profile", auth.GetProfile)
		protected.POST("/profile", auth.UpdateProfile)

		// Public Mode Routes
		protected.POST("/entries/:id/public", TogglePublic)
		protected.POST("/entries/:id/comments", PostComment)
	}

	r.Run(":8080")
}

func GetEntry(c *gin.Context) {
	id := c.Param("id")
	username := c.GetString("username")
	var entry DiaryEntry
	result := DB.Preload("Reflections").Where("id = ? AND username = ?", id, username).First(&entry)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entry not found"})
		return
	}

	if time.Now().Before(entry.UnlockAt) {
		entry.IsLocked = true
		entry.Content = ""
		entry.Reflection = ""
	} else {
		entry.IsLocked = false
	}

	c.JSON(http.StatusOK, entry)
}

func Respond(c *gin.Context) {
	id := c.Param("id")
	username := c.GetString("username")
	var input struct {
		Status     string `json:"status" binding:"required"`
		Reflection string `json:"reflection"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Load existing reflections
	var entry DiaryEntry
	result := DB.Preload("Reflections").Where("id = ? AND username = ?", id, username).First(&entry)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entry not found"})
		return
	}

	// Update NeedHelpCount based on status
	if input.Status == "need_help" {
		entry.NeedHelpCount++
	} else {
		entry.NeedHelpCount = 0 // Reset if they're feeling better
	}

	var aiResponse string
	var err error

	if input.Status == "over_it" {
		// Growth Summary Generation
		historyText := ""
		for _, h := range entry.Reflections {
			historyText += fmt.Sprintf("- Step: %s (Status: %s)\n", h.Content, h.Status)
		}

		prompt := fmt.Sprintf(`User is "Over It" (Finished).
		Original Entry: "%s"
		
		Journey/History:
		%s
		Final Reflection: "%s"
		
		Summarize their emotional growth and how they overcame this problem. Be supportive and congratulatory. Language: Thai.`,
			entry.Content, historyText, input.Reflection)

		aiResponse, err = generateContent(context.Background(), prompt)
		if err != nil {
			aiResponse = "ยินดีด้วยนะ! คุณเก่งมากที่ผ่านเรื่องนี้มาได้ 🌟"
		}

		entry.IsFinished = true
		entry.IsLocked = false
		entry.UnlockAt = time.Now() // Unlock immediately
	} else {
		// Normal Response
		aiResponse, err = callGeminiAPI(entry.Content, input.Reflection, input.Status, entry.NeedHelpCount)
		if err != nil {
			log.Printf("Gemini API error: %v", err)

			// Fallback messages if AI is down/limited
			fallbacks := map[string][]string{
				"over_it": {
					"ยินดีด้วยอย่างยิ่งเลยนะ! 🌟 การที่คุณก้าวผ่านความรู้สึกนี้มาได้ พิสูจน์ให้เห็นแล้วว่าหัวใจของคุณแข็งแกร่งมากแค่ไหน ไม่ใช่เรื่องง่ายเลยที่จะปล่อยวางและเดินหน้าต่อ แต่คุณก็ทำมันได้สำเร็จ จงภูมิใจในตัวเองให้มากๆ และเก็บรอยยิ้มนี้ไว้เป็นรางวัลของคนเก่งนะ 🎉💖",
					"สุดยอดไปเลย! 🌈 วันนี้ถือเป็นวันที่ท้องฟ้าสดใสของคุณจริงๆ นะ การที่เรื่องนี้ทำอะไรคุณไม่ได้อีกต่อไป แสดงว่าคุณเติบโตขึ้นอย่างงดงามจากบทเรียนที่ผ่านมา ขอให้ความสุขครั้งนี้อยู่กับคุณไปนานๆ และขอให้ทุกย่างก้าวต่อจากนี้เต็มไปด้วยพลังบวกนะ ✨💪",
					"ดีใจด้วยจริงๆ นะ! 🌻 ไม่มีชัยชนะไหนจะยิ่งใหญ่ไปกว่าการชนะใจตัวเอง ได้เห็นคุณมีความสุขแบบนี้ โลกก็ดูสดใสขึ้นมาทันทีเลย จำความรู้สึกเบาสบายใจนี้ไว้ดีๆ นะ เพราะนี่คือหลักฐานว่า 'เวลาและความเข้าใจ' จะช่วยเยียวยาทุกอย่างได้จริงๆ 😊🏳️",
					"ปรบมือให้ดังๆ เลย! 👏 การให้อภัยและปล่อยวางคือของขวัญล้ำค่าที่สุดที่คุณมอบให้ตัวเองได้ คุณเก่งมากที่เลือกความสงบสุขให้ใจตัวเอง เดินหน้าต่อไปด้วยความมั่นใจนะ เชื่อเลยว่าอนาคตที่สดใสกำลังรอต้อนรับคนเก่งอย่างคุณอยู่แน่นอน 🚀✨",
					"ยินดีต้อนรับความสุขกลับมานะ! 🎈 ความทุกข์อาจจะเคยเข้ามาทักทาย แต่ตอนนี้มันได้โบกมือลาคุณไปแล้ว ขอบคุณที่อดทนและเข้มแข็งมาตลอดทาง วันนี้อนุญาตให้ตัวเองยิ้มกว้างๆ หัวเราะดังๆ และมีความสุขได้เต็มที่เลยนะ คุณสมควรได้รับมันที่สุด! 🥰🎊",
					"เก่งหัวใจแกร่ง! ❤️‍🔥 การที่คุณบอกว่า 'เรื่องจิ๊บจ๊อย' ได้ในวันนี้ แสดงว่าคุณได้เปลี่ยนอุปสรรคให้กลายเป็นบันไดสู่ความเข้มแข็งเรียบร้อยแล้ว จงมั่นใจในศักยภาพของตัวเองนะ ไม่ว่าจะเจอปัญหาอะไรอีกในอนาคต เชื่อว่าคุณจะผ่านมันไปได้ฉลุยแน่นอน! 🌟🛡️",
				},
				"still_dealing": {
					"ไม่เป็นไรเลยนะที่ตอนนี้ยังรู้สึกไม่โอเค 🌧️ การเยียวยาจิตใจมันเหมือนการวิ่งมาราธอน ไม่ใช่การวิ่งแข่งระยะสั้น อนุญาตให้ตัวเองและหัวใจได้พักผ่อนบ้าง ค่อยๆ ก้าวไปทีละนิดตามจังหวะของตัวเอง วันนี้อาจจะเหนื่อยหน่อย แต่เราเชื่อหมดใจเลยว่าคุณจะผ่านมันไปได้แน่นอน ✌️🍂",
					"เหนื่อยก็พักก่อนนะคนเก่ง 🛋️ อย่ากดดันตัวเองว่าต้องรีบหาย ความเข้มแข็งไม่ได้แปลว่าต้องแบกโลกทั้งใบไว้ตลอดเวลา บางครั้งการยอมรับความอ่อนแอและดูแลใจตัวเองเบาๆ ก็คือความเข้มแข็งในรูปแบบหนึ่งนะ นอนตากลมสบายๆ ให้ใจได้ผ่อนคลาย พรุ่งนี้ค่อยว่ากันใหม่นะ 💛🌿",
					"วันนี้อาจจะดูมืดมนเหมือนพายุเข้า ⛈️ แต่มั่นใจได้เลยว่าไม่มีพายุลูกไหนพัดอยู่ตลอดกาล เดี๋ยวมันก็ผ่านไป และฟ้าหลังฝนจะงดงามเสมอ สูดหายใจลึกๆ โอบกอดตัวเองแน่นๆ แล้วบอกตัวเองว่า 'เราทำได้' เราคอยส่งกำลังใจให้คุณอยู่ตรงนี้เสมอนะ 🌈⛱️",
					"อยากให้รู้ว่าคุณไม่ได้กำลังสู้อยู่คนเดียวนะ 🤝 ความรู้สึกแย่ๆ มันเป็นแค่แขกขาจรที่มาแวะพักชั่วคราว เดี๋ยวมันก็ต้องจากไป อดทนกับตัวเองอีกนิด ใจดีกับตัวเองให้มากๆ ในวันที่ยากลำบาก แผลใจต้องใช้เวลาเยียวยา และเราเชื่อว่าคุณจะหายดีในไม่ช้าแน่นอน 🩹❤️",
					"ถ้ารู้สึกว่าวันนี้มันหนักเกินไป ลองวางภาระลงชั่วคราวแล้วหากิจกรรมที่ชอบทำดูไหม? 🎨🎧 การพาตัวเองออกมาจากจุดที่ตึงเครียด แม้เพียงชั่วครู่ ก็ช่วยเติมพลังให้ใจได้มากโขเลยนะ ค่อยๆ รักษาใจไปทีละวัน เราเป็นกำลังใจให้ทุกย่างก้าวของคุณเสมอ 🐢✨",
					"การร้องไห้ไม่ใช่เรื่องน่าอายนะ 😢 ถ้าน้ำตามันจะช่วยชะล้างความอัดอั้นในใจ ก็ปล่อยให้มันไหลออกมาเถอะ ระบายออกมาให้หมด แล้วพรุ่งนี้เรามาเริ่มนับหนึ่งกันใหม่ด้วยใจที่เบาสบายกว่าเดิมนะ กอดๆ ตัวเองแน่นๆ นะคนเก่ง คุณผ่านเรื่องยากๆ มาตั้งเยอะ ครั้งนี้คุณก็จะผ่านมันไปได้เหมือนกัน 🤗🌻",
				},
				"need_help": {
					"เราได้ยินเสียงหัวใจที่กำลังเจ็บปวดของคุณชัดเจนเลยนะ 💔 และเราอยากบอกว่า 'คุณไม่ได้อยู่ตัวคนเดียว' บนโลกใบนี้ ความรู้สึกดิ่งลึกขนาดนี้มันทรมานมากเรารู้ แต่ได้โปรดอย่าเพิ่งหมดหวังนะ ยังมีแสงสว่างเล็กๆ รอคุณอยู่เสมอ ลองมองหาคนรอบข้างที่พร้อมจะจับมือคุณเดินผ่านความมืดนี้ไปด้วยกันนะ 🕯️🤲",
					"ในวันที่โลกรู้สึกใจร้ายกับคุณ อยากให้คุณใจดีกับตัวเองให้มากที่สุดนะ 🌍🩹 การขอความช่วยเหลือไม่ได้แปลว่าคุณอ่อนแอ แต่มันคือความกล้าหาญที่ยิ่งใหญ่ที่สุดที่คุณจะมอบให้ตัวเองได้ ลองพูดคุยกับเพื่อนสนิท ครอบครัว หรือผู้เชี่ยวชาญดูนะ มีคนที่พร้อมจะโอบกอดและรับฟังคุณอยู่เสมอ 🗣️❤️",
					"กอดแน่นๆ เลยนะคนเก่ง 🫂 เรารู้ว่าตอนนี้มันยากลำบากเหลือเกิน แต่ชีวิตของคุณมีค่าและความหมายมากกว่าความเจ็บปวดในตอนนี้นะ เรื่องร้ายๆ วันนี้มันไม่ได้กำหนดชีวิตที่เหลือของคุณ ขอให้คุณอดทนและประคับประคองใจตัวเองผ่านคืนนี้ไปให้ได้ พายุร้ายกำลังจะผ่านพ้นไป อดทนอีกนิดเดียวนะ 🌈🛡️",
					"ความรู้สึกที่คุณแบกรับไว้มันหนักหนามากจริงๆ ⛰️ ถ้าคุณรู้สึกว่ารับมือคนเดียวไม่ไหว การวางลงและตะโกนขอความช่วยเหลือคือสิ่งที่ฉลาดที่สุดนะ อย่าปล่อยให้ความมืดกัดกินหัวใจอันมีค่าของคุณ ลองเอื้อมมือออกไปนะ มีมืออุ่นๆ อีกมากมายที่พร้อมจะช่วยพยุงคุณเสมอ 🤝💛",
					"จำไว้เสมอนะว่า 'การมีอยู่ของคุณมีความหมาย' 🌟 แม้ว่าวันนี้คุณอาจจะยังมองไม่เห็นทางออก แต่เชื่อเถอะว่าปัญหามีทางแก้เสมอ บางครั้งเราแค่ต้องการใครสักคนมาช่วยชี้ทางหรือแค่นั่งเป็นเพื่อนข้างๆ ลองทักหาเพื่อนหรือสายด่วนสุขภาพจิตดูนะ คุณไม่ควรต้องเผชิญเรื่องนี้เพียงลำพัง 📞💌",
					"โปรดอย่าเพิ่งถอดใจนะ 🛑 ชีวิตเปรียบเสมือนหนังสือเล่มหนา หน้าที่เลวร้ายหน้านี้ไม่ใช่ตอนจบของเรื่องราวชีวิตคุณ ยังมีบทที่สวยงามและมีความสุขรอให้คุณเขียนต่ออีกมากมาย ขอให้เชื่อมั่นในตัวเองเหมือนที่เราเชื่อในตัวคุณนะ คุณจะผ่านมันไปได้แน่นอน เราเป็นห่วงและส่งกำลังใจให้สุดหัวใจเลย ❤️‍🔥📖",
				},
			}

			// Select random message based on status
			if list, exists := fallbacks[input.Status]; exists && len(list) > 0 {
				aiResponse = list[rand.Intn(len(list))]
			} else {
				aiResponse = "ขอบคุณที่แบ่งปันความรู้สึก เราอยู่ตรงนี้นะ 💛"
			}
		}

		// Set lock times
		switch input.Status {
		case "still_dealing":
			entry.UnlockAt = time.Now().Add(12 * time.Hour)
			entry.IsLocked = true
		case "need_help":
			entry.UnlockAt = time.Now().Add(6 * time.Hour)
			entry.IsLocked = true
		}
	}

	// Save History
	newHistory := ReflectionHistory{
		DiaryEntryID: entry.ID,
		Content:      input.Reflection,
		Status:       input.Status,
		AIResponse:   aiResponse,
		CreatedAt:    time.Now(),
	}
	DB.Create(&newHistory)

	// Update Main Entry
	entry.Status = input.Status
	entry.Reflection = input.Reflection // Latest reflection
	entry.AIResponse = aiResponse       // Latest AI response

	DB.Save(&entry)

	c.JSON(http.StatusOK, gin.H{
		"entry":      entry,
		"aiResponse": aiResponse,
	})
}

func UnlockEntry(c *gin.Context) {
	id := c.Param("id")
	username := c.GetString("username")

	var entry DiaryEntry
	result := DB.Where("id = ? AND username = ?", id, username).First(&entry)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entry not found"})
		return
	}

	entry.UnlockAt = time.Now()
	DB.Save(&entry)

	c.JSON(http.StatusOK, gin.H{"message": "Entry unlocked", "id": entry.ID})
}

// DeleteEntry removes a diary entry
func DeleteEntry(c *gin.Context) {
	id := c.Param("id")
	username := c.GetString("username")

	var entry DiaryEntry
	result := DB.Where("id = ? AND username = ?", id, username).First(&entry)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entry not found"})
		return
	}

	DB.Delete(&entry)
	c.JSON(http.StatusOK, gin.H{"message": "Entry deleted", "id": entry.ID})
}

// GetSummary returns mental health statistics and AI analysis
func GetSummary(c *gin.Context) {
	val, _ := c.Get("username")
	username := val.(string)

	var entries []DiaryEntry
	DB.Where("username = ?", username).Find(&entries)

	// Generate hash of current data to detect changes
	var dataForHash strings.Builder
	for _, e := range entries {
		dataForHash.WriteString(fmt.Sprintf("%d:%s:%s:%s:%s:%d|", e.ID, e.Content, e.Reflection, e.Status, e.AIResponse, e.NeedHelpCount))
	}
	currentHash := fmt.Sprintf("%x", len(dataForHash.String())) + dataForHash.String()[:min(100, len(dataForHash.String()))]

	// Return cached result if data hasn't changed
	if cachedDataHash == currentHash && cachedSummary != nil {
		c.JSON(http.StatusOK, cachedSummary)
		return
	}

	// Calculate stats
	totalEntries := len(entries)
	overItCount := 0
	stillDealingCount := 0
	needHelpCount := 0
	pendingCount := 0 // Entries not yet reflected on
	totalNeedHelpStreak := 0

	var allContent strings.Builder
	var allReflections strings.Builder
	var allAIResponses strings.Builder
	var allStatuses strings.Builder

	for _, e := range entries {
		// Count by status
		switch e.Status {
		case "over_it":
			overItCount++
			allStatuses.WriteString("Entry: " + e.Title + " → เรื่องจิ๊บจ๊อย (จบแล้ว)\n")
		case "still_dealing":
			stillDealingCount++
			allStatuses.WriteString("Entry: " + e.Title + " → ยังสู้อยู่\n")
		case "need_help":
			needHelpCount++
			allStatuses.WriteString("Entry: " + e.Title + " → ไม่ไหวช่วยด้วย\n")
		default:
			pendingCount++ // No status = not yet reflected
			allStatuses.WriteString("Entry: " + e.Title + " → ยังไม่ได้ไตร่ตรอง\n")
		}

		if e.NeedHelpCount > totalNeedHelpStreak {
			totalNeedHelpStreak = e.NeedHelpCount
		}

		// Collect all content
		allContent.WriteString("บันทึก: " + e.Title + "\nเนื้อหา: " + e.Content + "\n\n")

		// Collect all reflections
		if e.Reflection != "" {
			allReflections.WriteString("สำหรับ " + e.Title + ": " + e.Reflection + "\n")
		}

		// Collect all AI responses
		if e.AIResponse != "" {
			allAIResponses.WriteString("AI ตอบสำหรับ " + e.Title + ": " + e.AIResponse + "\n")
		}
	}

	// Calculate mental state score (0-100, higher = better)
	var mentalScore int
	if totalEntries > 0 {
		resolved := overItCount + stillDealingCount
		mentalScore = (resolved * 100) / totalEntries
		if needHelpCount > 0 {
			mentalScore -= needHelpCount * 10
		}
		if mentalScore < 0 {
			mentalScore = 0
		}
	} else {
		mentalScore = 50 // neutral
	}

	// Determine mental state
	var mentalState string
	var mentalEmoji string
	if mentalScore >= 80 {
		mentalState = "ดีมาก"
		mentalEmoji = "🌟"
	} else if mentalScore >= 60 {
		mentalState = "ปกติ"
		mentalEmoji = "😊"
	} else if mentalScore >= 40 {
		mentalState = "ต้องดูแล"
		mentalEmoji = "😐"
	} else if mentalScore >= 20 {
		mentalState = "น่าห่วง"
		mentalEmoji = "😔"
	} else {
		mentalState = "ต้องการความช่วยเหลือ"
		mentalEmoji = "🆘"
	}

	// Call AI for overall summary
	aiSummary := ""
	if totalEntries > 0 {
		ctx := context.Background()
		prompt := fmt.Sprintf(`คุณคือนักจิตวิทยา กำลังวิเคราะห์ภาพรวมสุขภาพจิตของผู้ใช้จากข้อมูลทั้งหมดที่มี

📊 สถิติ:
- บันทึกทั้งหมด: %d รายการ
- เรื่องจิ๊บจ๊อย (จบแล้ว): %d ครั้ง
- ยังสู้อยู่: %d ครั้ง  
- ไม่ไหวช่วยด้วย: %d ครั้ง
- ยังไม่ได้ไตร่ตรอง: %d รายการ
- คะแนนสุขภาพจิต: %d/100

📝 เนื้อหาบันทึกทั้งหมด:
%s

💭 การไตร่ตรองทั้งหมด:
%s

🤖 AI ตอบกลับก่อนหน้า:
%s

📋 สถานะแต่ละรายการ:
%s

สรุปภาพรวมสุขภาพจิตของผู้ใช้ใน 3-4 ประโยค เป็นภาษาไทย วิเคราะห์จากเนื้อหาและการเปลี่ยนแปลง บอกจุดแข็ง จุดที่ต้องระวัง และคำแนะนำเฉพาะทาง`,
			totalEntries, overItCount, stillDealingCount, needHelpCount, pendingCount, mentalScore,
			allContent.String(), allReflections.String(), allAIResponses.String(), allStatuses.String())

		var err error
		aiSummary, err = generateContent(ctx, prompt)
		if err != nil {
			log.Printf("Failed to generate summary: %v", err)
		}
	}

	// Build result and cache it
	result := gin.H{
		"stats": gin.H{
			"total":          totalEntries,
			"overIt":         overItCount,
			"stillDealing":   stillDealingCount,
			"needHelp":       needHelpCount,
			"pending":        pendingCount,
			"needHelpStreak": totalNeedHelpStreak,
		},
		"mentalScore": mentalScore,
		"mentalState": mentalState,
		"mentalEmoji": mentalEmoji,
		"aiSummary":   aiSummary,
	}

	// Save to cache
	cachedSummary = result
	cachedDataHash = currentHash

	c.JSON(http.StatusOK, result)
}

// GetAIPrompts generates personalized writing prompts based on patterns
func GetAIPrompts(c *gin.Context) {
	username := c.GetString("username")
	var entries []DiaryEntry
	DB.Where("username = ?", username).Find(&entries)

	var recentTopics strings.Builder
	for i, e := range entries {
		if i >= 5 {
			break
		}
		recentTopics.WriteString(e.Title + " (mood: " + e.Mood + ")\n")
	}

	ctx := context.Background()

	prompt := fmt.Sprintf(`Based on these recent diary topics, suggest 3 personalized writing prompts in Thai:
%s

Generate 3 short prompts (1 sentence each) that would help the user explore their emotions. Format as JSON array: ["prompt1", "prompt2", "prompt3"]`, recentTopics.String())

	resultText, err := generateContent(ctx, prompt)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"prompts": []string{"วันนี้รู้สึกอย่างไรบ้าง?", "มีเรื่องอะไรค้างคาในใจไหม?", "อยากบอกอะไรกับตัวเองในอนาคต?"}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"prompts": resultText})
}

// GetWeeklyDigest generates a weekly mental health summary
func GetWeeklyDigest(c *gin.Context) {
	weekAgo := time.Now().AddDate(0, 0, -7)
	username := c.GetString("username")
	var entries []DiaryEntry
	DB.Where("username = ? AND created_at >= ?", username, weekAgo).Find(&entries)

	if len(entries) == 0 {
		c.JSON(http.StatusOK, gin.H{"digest": "สัปดาห์นี้ยังไม่มีบันทึก ลองเขียนอะไรสักอย่างสิ!", "hasData": false})
		return
	}

	var weekContent strings.Builder
	moodCounts := make(map[string]int)
	statusCounts := make(map[string]int)

	for _, e := range entries {
		weekContent.WriteString(e.Title + ": " + e.Content[:min(100, len(e.Content))] + "\n")
		if e.Mood != "" {
			moodCounts[e.Mood]++
		}
		if e.Status != "" {
			statusCounts[e.Status]++
		}
	}

	ctx := context.Background()

	prompt := fmt.Sprintf(`สรุปสุขภาพจิตประจำสัปดาห์ จากบันทึก %d รายการ:
%s

เขียนสรุปสั้นๆ 2-3 ประโยค เป็นภาษาไทย บอกแนวโน้มอารมณ์และคำแนะนำ`, len(entries), weekContent.String())

	resultText, _ := generateContent(ctx, prompt)

	c.JSON(http.StatusOK, gin.H{
		"digest":     resultText,
		"hasData":    true,
		"entryCount": len(entries),
		"moods":      moodCounts,
		"statuses":   statusCounts,
	})
}

// GetPatternAlerts detects negative patterns and provides support
func GetPatternAlerts(c *gin.Context) {
	username := c.GetString("username")
	var entries []DiaryEntry
	DB.Where("username = ?", username).Order("created_at desc").Limit(10).Find(&entries)

	needHelpCount := 0
	consecutiveNeedHelp := 0
	maxStreak := 0

	for _, e := range entries {
		if e.Status == "need_help" {
			needHelpCount++
			consecutiveNeedHelp++
			if consecutiveNeedHelp > maxStreak {
				maxStreak = consecutiveNeedHelp
			}
		} else {
			consecutiveNeedHelp = 0
		}
	}

	alerts := []gin.H{}

	if maxStreak >= 3 {
		alerts = append(alerts, gin.H{
			"type":    "critical",
			"title":   "🆘 ต้องการความช่วยเหลือ",
			"message": fmt.Sprintf("คุณเลือก 'ไม่ไหว ช่วยด้วย' %d ครั้งติดต่อกัน สายด่วนสุขภาพจิต 1323 พร้อมรับฟังคุณ", maxStreak),
		})
	} else if maxStreak >= 2 {
		alerts = append(alerts, gin.H{
			"type":    "warning",
			"title":   "💛 เราห่วงใยคุณ",
			"message": "ดูเหมือนคุณกำลังเผชิญช่วงเวลาที่ยากลำบาก อย่าลืมดูแลตัวเองนะ",
		})
	}

	if needHelpCount > 5 {
		alerts = append(alerts, gin.H{
			"type":    "info",
			"title":   "📊 สังเกตแนวโน้ม",
			"message": fmt.Sprintf("จาก 10 รายการล่าสุด คุณรู้สึกต้องการช่วยเหลือ %d ครั้ง พิจารณาพูดคุยกับคนใกล้ชิด", needHelpCount),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts":       alerts,
		"needHelpRate": float64(needHelpCount) / float64(max(len(entries), 1)) * 100,
		"maxStreak":    maxStreak,
	})
}

// GetPreferences returns all stored user preferences
func GetPreferences(c *gin.Context) {
	username := c.GetString("username")
	var prefs []UserPreference
	DB.Where("username = ?", username).Find(&prefs)
	c.JSON(http.StatusOK, prefs)
}

// SavePreference stores a user's Q&A answer for AI learning
func SavePreference(c *gin.Context) {
	var input struct {
		Question string `json:"question" binding:"required"`
		Answer   string `json:"answer" binding:"required"`
		Category string `json:"category"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pref := UserPreference{
		Username: c.GetString("username"),
		Question: input.Question,
		Answer:   input.Answer,
		Category: input.Category,
	}
	DB.Create(&pref)
	c.JSON(http.StatusCreated, pref)
}

// GetAIQuestions generates personalized questions based on user history
func GetAIQuestions(c *gin.Context) {
	// Get existing preferences and entries to personalize questions
	username := c.GetString("username")
	var prefs []UserPreference
	var entries []DiaryEntry
	DB.Where("username = ?", username).Find(&prefs)
	DB.Where("username = ?", username).Order("created_at desc").Limit(5).Find(&entries)

	// Build context for AI
	var context strings.Builder
	context.WriteString("คำตอบที่ผู้ใช้เคยตอบ:\n")
	for _, p := range prefs {
		context.WriteString(fmt.Sprintf("- %s: %s\n", p.Question, p.Answer))
	}
	context.WriteString("\nบันทึกล่าสุด:\n")
	for _, e := range entries {
		mood := e.Mood
		if mood == "" {
			mood = "ไม่ระบุ"
		}
		context.WriteString(fmt.Sprintf("- %s (อารมณ์: %s)\n", e.Title, mood))
	}

	ctx := context2.Background()

	prompt := fmt.Sprintf(`จากข้อมูลผู้ใช้นี้:
%s

สร้าง 3 คำถามสั้นๆ เป็นภาษาไทย เพื่อเรียนรู้เกี่ยวกับผู้ใช้มากขึ้น
คำถามควรเกี่ยวกับ: อารมณ์, วิธีจัดการความเครียด, สิ่งที่ทำให้มีความสุข
ตอบเป็น JSON: [{"id":1,"text":"คำถาม","category":"emotion/coping/positive"}]`, context.String())

	// Static pool of questions for fallback
	fallbackQuestions := []map[string]interface{}{
		{"id": 1, "text": "วันนี้มีเรื่องอะไรที่ทำให้ยิ้มได้บ้าง?", "category": "positive"},
		{"id": 2, "text": "เป้าหมายเล็กๆ ของวันนี้คืออะไร?", "category": "goal"},
		{"id": 3, "text": "ช่วงนี้มีเพลงอะไรที่ชอบฟังเป็นพิเศษไหม?", "category": "hobby"},
		{"id": 4, "text": "ให้คะแนนระดับพลังงานตัวเองวันนี้หน่อย (1-10)", "category": "checkin"},
		{"id": 5, "text": "วันนี้อยากกินอะไรเป็นพิเศษไหม?", "category": "food"},
		{"id": 6, "text": "มีเรื่องอะไรที่อยากขอบคุณตัวเองบ้าง?", "category": "gratitude"},
		{"id": 7, "text": "ถ้าวันนี้ขอพรได้ 1 ข้อ จะขออะไร?", "category": "dream"},
		{"id": 8, "text": "ความรู้สึกไหนที่อยากปลดปล่อยออกไปมากที่สุด?", "category": "emotion"},
		{"id": 9, "text": "วันนี้ท้องฟ้าเป็นยังไงบ้างในสายตาคุณ?", "category": "observation"},
		{"id": 10, "text": "มีใครที่คิดถึงเป็นพิเศษไหมวันนี้?", "category": "relationship"},
	}

	resultText, err := generateContent(ctx, prompt)
	if err != nil {
		// Randomly select 3 unique questions
		rand.Shuffle(len(fallbackQuestions), func(i, j int) {
			fallbackQuestions[i], fallbackQuestions[j] = fallbackQuestions[j], fallbackQuestions[i]
		})

		selected := fallbackQuestions[:3]
		// Convert ID to int to match frontend expectation if needed, although interface{} handles it

		c.JSON(http.StatusOK, gin.H{"questions": selected})
		return
	}

	c.JSON(http.StatusOK, gin.H{"questions": resultText})
}
