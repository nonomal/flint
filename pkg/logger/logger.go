package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"runtime"
	"strings"
	"time"
)

// Level represents the logging level
type Level int

const (
	// DEBUG level
	DEBUG Level = iota
	// INFO level
	INFO
	// WARN level
	WARN
	// ERROR level
	ERROR
	// FATAL level
	FATAL
)

// String returns the string representation of the level
func (l Level) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case FATAL:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// Logger represents a structured logger
type Logger struct {
	level  Level
	writer io.Writer
}

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Service   string                 `json:"service"`
	Function  string                 `json:"function,omitempty"`
	File      string                 `json:"file,omitempty"`
	Line      int                    `json:"line,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

// NewLogger creates a new logger with the specified level
func NewLogger(level Level) *Logger {
	return &Logger{
		level:  level,
		writer: os.Stdout,
	}
}

// NewLoggerWithWriter creates a new logger with a custom writer
func NewLoggerWithWriter(level Level, writer io.Writer) *Logger {
	return &Logger{
		level:  level,
		writer: writer,
	}
}

// SetLevel sets the logging level
func (l *Logger) SetLevel(level Level) {
	l.level = level
}

// log writes a log entry
func (l *Logger) log(level Level, message string, fields map[string]interface{}) {
	if level < l.level {
		return
	}

	// Get caller information
	pc, file, line, ok := runtime.Caller(2)
	funcName := "unknown"
	if ok {
		funcName = runtime.FuncForPC(pc).Name()
		// Extract just the function name
		if idx := strings.LastIndex(funcName, "."); idx > 0 {
			funcName = funcName[idx+1:]
		}
	}

	// Extract just the filename
	filename := "unknown"
	if idx := strings.LastIndex(file, "/"); idx > 0 {
		filename = file[idx+1:]
	}

	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     level.String(),
		Message:   message,
		Service:   "flint",
		Function:  funcName,
		File:      filename,
		Line:      line,
		Fields:    fields,
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(entry)
	if err != nil {
		// Fallback to simple logging if JSON marshaling fails
		log.Printf("[%s] %s: %s", level.String(), funcName, message)
		return
	}

	// Write to output
	fmt.Fprintln(l.writer, string(jsonData))
}

// Debug logs a debug message
func (l *Logger) Debug(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(DEBUG, message, f)
}

// Info logs an info message
func (l *Logger) Info(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(INFO, message, f)
}

// Warn logs a warning message
func (l *Logger) Warn(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(WARN, message, f)
}

// Error logs an error message
func (l *Logger) Error(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(ERROR, message, f)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(FATAL, message, f)
	os.Exit(1)
}

// WithFields returns a logger with additional fields
func (l *Logger) WithFields(fields map[string]interface{}) *LoggerWithFields {
	return &LoggerWithFields{
		logger: l,
		fields: fields,
	}
}

// LoggerWithFields represents a logger with predefined fields
type LoggerWithFields struct {
	logger *Logger
	fields map[string]interface{}
}

// Debug logs a debug message with predefined fields
func (l *LoggerWithFields) Debug(message string, fields ...map[string]interface{}) {
	combinedFields := l.combineFields(fields...)
	l.logger.log(DEBUG, message, combinedFields)
}

// Info logs an info message with predefined fields
func (l *LoggerWithFields) Info(message string, fields ...map[string]interface{}) {
	combinedFields := l.combineFields(fields...)
	l.logger.log(INFO, message, combinedFields)
}

// Warn logs a warning message with predefined fields
func (l *LoggerWithFields) Warn(message string, fields ...map[string]interface{}) {
	combinedFields := l.combineFields(fields...)
	l.logger.log(WARN, message, combinedFields)
}

// Error logs an error message with predefined fields
func (l *LoggerWithFields) Error(message string, fields ...map[string]interface{}) {
	combinedFields := l.combineFields(fields...)
	l.logger.log(ERROR, message, combinedFields)
}

// Fatal logs a fatal message with predefined fields and exits
func (l *LoggerWithFields) Fatal(message string, fields ...map[string]interface{}) {
	combinedFields := l.combineFields(fields...)
	l.logger.log(FATAL, message, combinedFields)
	os.Exit(1)
}

// combineFields combines predefined fields with additional fields
func (l *LoggerWithFields) combineFields(additional ...map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// Copy predefined fields
	for k, v := range l.fields {
		result[k] = v
	}

	// Add additional fields
	if len(additional) > 0 && additional[0] != nil {
		for k, v := range additional[0] {
			result[k] = v
		}
	}

	return result
}

// Global logger instance
var globalLogger *Logger

// init initializes the global logger
func init() {
	// Default to INFO level
	globalLogger = NewLogger(INFO)
}

// SetGlobalLevel sets the global logger level
func SetGlobalLevel(level Level) {
	globalLogger.SetLevel(level)
}

// Debug logs a debug message using the global logger
func Debug(message string, fields ...map[string]interface{}) {
	globalLogger.Debug(message, fields...)
}

// Info logs an info message using the global logger
func Info(message string, fields ...map[string]interface{}) {
	globalLogger.Info(message, fields...)
}

// Warn logs a warning message using the global logger
func Warn(message string, fields ...map[string]interface{}) {
	globalLogger.Warn(message, fields...)
}

// Error logs an error message using the global logger
func Error(message string, fields ...map[string]interface{}) {
	globalLogger.Error(message, fields...)
}

// Fatal logs a fatal message using the global logger and exits
func Fatal(message string, fields ...map[string]interface{}) {
	globalLogger.Fatal(message, fields...)
}
