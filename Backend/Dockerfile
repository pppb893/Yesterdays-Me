# Build stage
FROM golang:1.24-alpine AS builder

# Install build dependencies for CGO (required for go-sqlite3)
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Tidy dependencies
RUN go mod tidy

# Build the application
# CGO_ENABLED=1 is required for sqlite3
RUN CGO_ENABLED=1 GOOS=linux go build -o main .

# Run stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies (if any)
RUN apk add --no-cache ca-certificates

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port (matches main.go)
EXPOSE 8080

# Command to run
CMD ["./main"]
