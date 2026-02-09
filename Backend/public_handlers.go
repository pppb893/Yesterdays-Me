package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetPublicEntries returns all public diary entries (unlocked)
func GetPublicEntries(c *gin.Context) {
	var entries []DiaryEntry
	// Only get public entries that are not locked
	now := time.Now()
	result := DB.Where("is_public = ? AND unlock_at <= ?", true, now).Order("created_at desc").Find(&entries)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Filter out sensitive data for anonymous posts
	for i := range entries {
		if entries[i].IsAnonymous {
			entries[i].Username = "Anonymous"
		}
	}

	c.JSON(http.StatusOK, entries)
}

// TogglePublic handles making a diary public or private
func TogglePublic(c *gin.Context) {
	id := c.Param("id")
	username := c.GetString("username")

	var input struct {
		IsPublic    bool `json:"isPublic"`
		IsAnonymous bool `json:"isAnonymous"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var entry DiaryEntry
	result := DB.Where("id = ? AND username = ?", id, username).First(&entry)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Entry not found"})
		return
	}

	entry.IsPublic = input.IsPublic
	entry.IsAnonymous = input.IsAnonymous
	DB.Save(&entry)

	c.JSON(http.StatusOK, entry)
}

// PostComment handles adding a comment to a public diary
func PostComment(c *gin.Context) {
	diaryID := c.Param("id")
	username := c.GetString("username")

	var input struct {
		Content     string `json:"content" binding:"required"`
		IsAnonymous bool   `json:"isAnonymous"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Get the diary entry to moderate against
	var entry DiaryEntry
	if err := DB.First(&entry, diaryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Diary entry not found"})
		return
	}

	if !entry.IsPublic {
		c.JSON(http.StatusForbidden, gin.H{"error": "This diary is not public"})
		return
	}

	// 2. AI Moderation
	allowed, reason, err := ModerateComment(entry.Content, input.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to moderate comment"})
		return
	}

	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{
			"error":  "Comment rejected by AI moderation",
			"reason": reason,
		})
		return
	}

	// 3. Save comment
	comment := Comment{
		DiaryID:     entry.ID,
		Username:    username,
		Content:     input.Content,
		IsAnonymous: input.IsAnonymous,
		CreatedAt:   time.Now(),
	}

	if err := DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// For response, hide username if anonymous
	if comment.IsAnonymous {
		comment.Username = "Anonymous"
	}

	c.JSON(http.StatusCreated, comment)
}

// GetComments returns all comments for a specific diary
func GetComments(c *gin.Context) {
	diaryID := c.Param("id")

	var comments []Comment
	result := DB.Where("diary_id = ?", diaryID).Order("created_at asc").Find(&comments)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// Handle anonymity
	for i := range comments {
		if comments[i].IsAnonymous {
			comments[i].Username = "Anonymous"
		}
	}

	c.JSON(http.StatusOK, comments)
}
