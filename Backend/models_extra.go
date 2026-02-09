package main

import (
	"time"
)

type Comment struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	DiaryID     uint      `json:"diaryId"`
	Username    string    `json:"username"`
	Content     string    `json:"content"`
	IsAnonymous bool      `json:"isAnonymous"`
	CreatedAt   time.Time `json:"createdAt"`
}
