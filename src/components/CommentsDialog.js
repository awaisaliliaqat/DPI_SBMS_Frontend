import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Avatar,
  CircularProgress,
} from '@mui/material';
import CommentIcon from '@mui/icons-material/Comment';

/**
 * CommentsDialog Component
 * Handles both Add Comment and View Messages dialogs
 */
export default function CommentsDialog({
  // Add Comment Dialog Props
  addCommentDialogOpen,
  onCloseAddComment,
  onConfirmAddComment,
  newComment,
  onCommentChange,
  isLoading,
  requestId,
  
  // Messages Dialog Props
  messagesDialogOpen,
  onCloseMessages,
  messages,
  loadingMessages,
  canAddComment,
  currentUser,
  onSendMessage,
  onClearMessage,
}) {
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getCommentTypeLabel = (commentType) => {
    if (commentType === 'vendor') return 'Vendor';
    if (commentType === 'areahead') return 'Area Head';
    return commentType || 'Unknown';
  };

  const getCommentTypeStyles = (commentType) => {
    if (commentType === 'vendor') {
      return { backgroundColor: '#e8f5e9', color: '#2e7d32' };
    }
    if (commentType === 'areahead') {
      return { backgroundColor: '#e3f2fd', color: '#1565c0' };
    }
    if (commentType === 'Area Head') {
      return { backgroundColor: '#e3f2fd', color: '#1565c0' };
    }
    if (commentType === 'Vendor Manager') {
      return { backgroundColor: '#f3e5f5', color: '#7b1fa2' };
    }
    if (commentType === 'Auditor') {
      return { backgroundColor: '#fff3e0', color: '#e65100' };
    }
    if (commentType === 'Super Admin') {
      return { backgroundColor: '#ffebee', color: '#c62828' };
    }
    if (commentType === 'CEO') {
      return { backgroundColor: '#e8f5e9', color: '#2e7d32' };
    }
    return { backgroundColor: '#f5f5f5', color: '#424242' };
  };

  return (
    <>
      {/* Add Comment Dialog */}
      <Dialog
        open={addCommentDialogOpen}
        onClose={onCloseAddComment}
        aria-labelledby="add-comment-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            m: { xs: 2, sm: 3 },
            width: { xs: 'calc(100% - 32px)', md: '600px', lg: '800px' },
            maxWidth: { xs: 'calc(100% - 32px)', md: '600px', lg: '800px' }
          }
        }}
      >
        <DialogTitle 
          id="add-comment-dialog-title"
          sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            py: 2.5,
            px: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <CommentIcon sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              Add Comment
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.75rem' }}>
              Request #{requestId}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: 3 }}>
          <Box sx={{ 
            mb: 3, 
            p: 2, 
            backgroundColor: '#f8f9fa', 
            borderRadius: 2,
            border: '1px solid #e9ecef'
          }}>
            <Typography variant="body2" sx={{ color: '#495057', fontWeight: 500 }}>
              Share your thoughts or provide feedback for this request
            </Typography>
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={5}
            label="Your Comment"
            placeholder="Type your comment here... Be clear and concise."
            value={newComment}
            onChange={(e) => onCommentChange(e.target.value)}
            variant="outlined"
            disabled={isLoading}
            sx={{ 
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#ffffff',
                borderRadius: 2,
                '&:hover': {
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                  }
                },
                '&.Mui-focused': {
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                    borderWidth: 2
                  }
                }
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#667eea'
              }
            }}
            helperText={`${newComment.length} characters`}
            inputProps={{
              maxLength: 1000
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, gap: 2, borderTop: '1px solid #e9ecef' }}>
          <Button 
            onClick={onCloseAddComment}
            variant="outlined"
            disabled={isLoading}
            sx={{ 
              color: '#6c757d',
              borderColor: '#dee2e6',
              borderRadius: 2,
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#adb5bd',
                backgroundColor: '#f8f9fa',
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirmAddComment}
            variant="contained"
            disabled={isLoading || !newComment.trim()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              borderRadius: 2,
              px: 4,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)',
              },
              '&:disabled': {
                background: '#e9ecef',
                color: '#adb5bd',
                boxShadow: 'none'
              }
            }}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <CommentIcon />}
          >
            {isLoading ? 'Sending...' : 'Send Comment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Messages Dialog */}
      <Dialog
        open={messagesDialogOpen}
        onClose={onCloseMessages}
        aria-labelledby="messages-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: '#ffffff',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            m: { xs: 1, sm: 3 },
            width: { xs: 'calc(100% - 16px)', md: '900px', lg: '1100px' },
            maxWidth: { xs: 'calc(100% - 16px)', md: '900px', lg: '1100px' },
            maxHeight: { xs: '95vh', sm: '90vh' },
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <DialogTitle 
          id="messages-dialog-title"
          sx={{ 
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            py: 2.5,
            px: { xs: 2, sm: 3 },
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '3px solid rgba(255,255,255,0.2)'
          }}
        >
          <CommentIcon sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              Messages & Comments
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.75rem' }}>
              Request #{requestId}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1, 
          overflow: 'hidden',
          p: { xs: 2, sm: 2.5 },
          pt: { xs: 3, sm: 3.5 },
          gap: 1.5,
          minHeight: 0
        }}>
          {/* Messages Section */}
          <Box sx={{ 
            flex: 1, 
            overflow: 'auto', 
            mb: 1,
            minHeight: 0,
            pt: 2,
            pr: { xs: 0.5, sm: 1 },
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#c1c1c1',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: '#a8a8a8',
              }
            }
          }}>
            {loadingMessages ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 6, gap: 2 }}>
                <CircularProgress size={40} sx={{ color: '#1976d2' }} />
                <Typography variant="body2" sx={{ color: '#666' }}>
                  Loading messages...
                </Typography>
              </Box>
            ) : messages.length === 0 ? (
              <Box sx={{ 
                textAlign: 'center', 
                p: 6,
                backgroundColor: '#f8f9fa',
                borderRadius: 2,
                border: '2px dashed #dee2e6'
              }}>
                <CommentIcon sx={{ fontSize: '4rem', color: '#adb5bd', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#495057', mb: 1, fontWeight: 600 }}>
                  No messages yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#6c757d' }}>
                  Start the conversation by sending the first message
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {messages.map((comment, index) => {
                  const isCurrentUser = comment.user?.id === currentUser?.id;
                  
                  return (
                    <Box 
                      key={index} 
                      sx={{ 
                        display: 'flex',
                        gap: 2,
                        flexDirection: isCurrentUser ? 'row-reverse' : 'row',
                        alignItems: 'flex-start'
                      }}
                    >
                      {/* Avatar */}
                      <Avatar 
                        sx={{ 
                          width: { xs: 36, sm: 40 },
                          height: { xs: 36, sm: 40 },
                          bgcolor: isCurrentUser ? '#1976d2' : '#667eea',
                          fontWeight: 'bold',
                          fontSize: { xs: '0.875rem', sm: '1rem' }
                        }}
                      >
                        {getInitials(comment.user?.username || 'Unknown')}
                      </Avatar>
                      
                      {/* Message Content */}
                      <Box sx={{ 
                        flex: 1,
                        maxWidth: { xs: 'calc(100% - 60px)', sm: 'calc(100% - 80px)' },
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5
                      }}>
                        <Box sx={{ 
                          p: { xs: 1.5, sm: 2 }, 
                          borderRadius: 3,
                          backgroundColor: isCurrentUser ? '#e3f2fd' : '#f5f5f5',
                          border: `1px solid ${isCurrentUser ? '#bbdefb' : '#e0e0e0'}`,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          position: 'relative',
                          '&::before': isCurrentUser ? {
                            content: '""',
                            position: 'absolute',
                            right: '-8px',
                            top: '12px',
                            width: 0,
                            height: 0,
                            borderTop: '8px solid transparent',
                            borderBottom: '8px solid transparent',
                            borderLeft: '8px solid #e3f2fd'
                          } : {
                            content: '""',
                            position: 'absolute',
                            left: '-8px',
                            top: '12px',
                            width: 0,
                            height: 0,
                            borderTop: '8px solid transparent',
                            borderBottom: '8px solid transparent',
                            borderRight: '8px solid #f5f5f5'
                          }
                        }}>
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            mb: 1,
                            flexWrap: 'wrap',
                            gap: 1
                          }}>
                            <Typography variant="subtitle2" sx={{ 
                              fontWeight: 'bold',
                              color: isCurrentUser ? '#1565c0' : '#333',
                              fontSize: { xs: '0.875rem', sm: '0.9375rem' }
                            }}>
                              {comment.user ? comment.user.username : 'Unknown User'}
                            </Typography>
                            <Typography variant="caption" sx={{ 
                              color: '#6c757d',
                              fontSize: { xs: '0.7rem', sm: '0.75rem' }
                            }}>
                              {comment.created_at ? new Date(comment.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'Unknown Date'}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ 
                            color: '#212529',
                            lineHeight: 1.6,
                            fontSize: { xs: '0.875rem', sm: '0.9375rem' },
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {comment.comment}
                          </Typography>
                          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                            <Chip 
                              label={getCommentTypeLabel(comment.comment_type)} 
                              size="small" 
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                ...getCommentTypeStyles(comment.comment_type),
                                border: 'none'
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
          
          {/* Send Message Section - Always Visible */}
          {canAddComment && (
            <Box sx={{ 
              p: { xs: 1.5, sm: 2 }, 
              border: '2px solid #e3f2fd', 
              borderRadius: 2, 
              backgroundColor: '#f8f9ff',
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
              flexShrink: 0
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CommentIcon sx={{ color: '#1976d2', fontSize: { xs: '1.25rem', sm: '1.5rem' } }} />
                <Typography variant="subtitle1" sx={{ 
                  fontWeight: 'bold', 
                  color: '#1976d2',
                  fontSize: { xs: '0.9rem', sm: '1rem' }
                }}>
                  Send New Message
                </Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Your Message"
                placeholder="Type your message here..."
                value={newComment}
                onChange={(e) => onCommentChange(e.target.value)}
                variant="outlined"
                disabled={isLoading}
                sx={{ 
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#ffffff',
                    borderRadius: 2,
                    '&:hover': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#1976d2',
                      }
                    },
                    '&.Mui-focused': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#1976d2',
                        borderWidth: 2
                      }
                    }
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#1976d2'
                  }
                }}
                helperText={`${newComment.length} characters`}
                inputProps={{
                  maxLength: 1000
                }}
              />
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: 1.5,
                flexWrap: 'wrap'
              }}>
                <Button 
                  onClick={onClearMessage}
                  variant="outlined"
                  disabled={isLoading || !newComment.trim()}
                  size="small"
                  sx={{ 
                    borderRadius: 1.5,
                    px: 2,
                    py: 0.5,
                    textTransform: 'none',
                    fontWeight: 500,
                    borderColor: '#dee2e6',
                    color: '#6c757d',
                    fontSize: '0.875rem',
                    '&:hover': {
                      borderColor: '#adb5bd',
                      backgroundColor: '#f8f9fa'
                    }
                  }}
                >
                  Clear
                </Button>
                <Button 
                  onClick={onSendMessage}
                  variant="contained"
                  disabled={isLoading || !newComment.trim()}
                  size="small"
                  sx={{ 
                    background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                    color: '#ffffff',
                    borderRadius: 1.5,
                    px: 3,
                    py: 0.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                      boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
                    },
                    '&:disabled': {
                      background: '#e9ecef',
                      color: '#adb5bd',
                      boxShadow: 'none'
                    }
                  }}
                  startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <CommentIcon sx={{ fontSize: '1rem' }} />}
                >
                  {isLoading ? 'Sending...' : 'Send'}
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: { xs: 2, sm: 3 }, 
          gap: 2, 
          backgroundColor: '#f8f9fa', 
          borderTop: '1px solid #e9ecef' 
        }}>
          <Button 
            onClick={onCloseMessages}
            variant="outlined"
            sx={{ 
              color: '#6c757d',
              borderColor: '#dee2e6',
              borderRadius: 2,
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 500,
              '&:hover': {
                borderColor: '#adb5bd',
                backgroundColor: '#ffffff',
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

