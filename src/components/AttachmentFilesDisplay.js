import * as React from 'react';
import {
  Box,
  Typography,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBackIosNew as ArrowBackIosNewIcon,
  ArrowForwardIos as ArrowForwardIosIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { BASE_URL } from '../constants/Constants';

async function openFileInNewTab(url) {
  if (!url) return;
  if (url.startsWith('data:')) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
}

function getFileUrlAndName(item, index, fallbackLabel) {
  if (item == null) return { url: '', fileName: fallbackLabel, mimeType: null };
  if (typeof item === 'object' && item.url != null) {
    return {
      url: item.url,
      fileName: item.fileName || fallbackLabel,
      mimeType: item.mimeType || null,
    };
  }
  const str = typeof item === 'string' ? item : '';
  const fileName = str.startsWith('data:') ? fallbackLabel : str.split('/').pop() || fallbackLabel;
  return { url: str, fileName, mimeType: null };
}

function resolveFileUrl(url, uploadFolder) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  if (uploadFolder) return `${BASE_URL}/uploads/${uploadFolder}/${url}`;
  // Legacy invoice paths are often already relative (e.g. uploads/invoices/...)
  return `${BASE_URL}/${url}`;
}

function isImageFile({ url, fileName, mimeType }) {
  if (mimeType && String(mimeType).toLowerCase().startsWith('image/')) return true;
  if (url && url.startsWith('data:')) {
    const m = url.match(/^data:([^;]+);/);
    return m && (m[1] || '').toLowerCase().startsWith('image/');
  }
  const name = `${fileName || ''} ${url || ''}`.toLowerCase();
  return /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?|$)/i.test(name);
}

/**
 * Renders attachment files: images inline (click → same-page lightbox),
 * PDF / unsupported types as chips that open in a new tab.
 */
export default function AttachmentFilesDisplay({
  files,
  uploadFolder,
  fallbackLabel = 'File',
  chipColor = 'primary',
  emptyText = 'No files uploaded',
}) {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  const items = React.useMemo(() => {
    if (!Array.isArray(files) || files.length === 0) return [];
    return files.map((file, index) => {
      const { url, fileName, mimeType } = getFileUrlAndName(
        file,
        index,
        `${fallbackLabel} ${index + 1}`
      );
      const fileUrl = resolveFileUrl(url, uploadFolder);
      return {
        key: index,
        fileUrl,
        fileName,
        mimeType,
        isImage: isImageFile({ url: fileUrl || url, fileName, mimeType }),
      };
    });
  }, [files, uploadFolder, fallbackLabel]);

  const imageItems = React.useMemo(
    () => items.filter((item) => item.isImage && item.fileUrl),
    [items]
  );

  const openLightboxAtItem = (item) => {
    const imageIndex = imageItems.findIndex((img) => img.key === item.key);
    if (imageIndex < 0) return;
    setLightboxIndex(imageIndex);
    setLightboxOpen(true);
  };

  const goPrev = () => {
    setLightboxIndex((prev) => (prev - 1 + imageItems.length) % imageItems.length);
  };

  const goNext = () => {
    setLightboxIndex((prev) => (prev + 1) % imageItems.length);
  };

  if (items.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
        {emptyText}
      </Typography>
    );
  }

  const chipHover =
    chipColor === 'secondary'
      ? '#f3e5f5'
      : chipColor === 'success'
        ? '#e8f5e8'
        : '#e3f2fd';

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
        {items.map((item, index) => {
          if (item.isImage && item.fileUrl) {
            return (
              <Box
                key={`img-${item.key}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  maxWidth: '100%',
                }}
              >
                <Box
                  onClick={() => openLightboxAtItem(item)}
                  sx={{
                    width: 120,
                    height: 90,
                    flexShrink: 0,
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0',
                    cursor: 'pointer',
                    backgroundColor: '#fff',
                    '&:hover': { boxShadow: 2, borderColor: 'primary.main' },
                  }}
                  title="View on this page"
                >
                  <Box
                    component="img"
                    src={item.fileUrl}
                    alt={item.fileName}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </Box>
                <Chip
                  label={item.fileName}
                  size="small"
                  color={chipColor}
                  variant="outlined"
                  onClick={() => openFileInNewTab(item.fileUrl)}
                  title="Open in new tab"
                  sx={{
                    cursor: 'pointer',
                    maxWidth: 220,
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                    '&:hover': { backgroundColor: chipHover },
                  }}
                />
              </Box>
            );
          }

          const isPdf =
            (item.mimeType && String(item.mimeType).toLowerCase().includes('pdf')) ||
            /\.pdf(\?|$)/i.test(`${item.fileName || ''} ${item.fileUrl || ''}`);

          return (
            <Chip
              key={`file-${index}`}
              icon={isPdf ? <PdfIcon /> : <FileIcon />}
              label={item.fileName}
              size="small"
              color={chipColor}
              variant="outlined"
              onClick={() => openFileInNewTab(item.fileUrl)}
              sx={{ cursor: 'pointer', '&:hover': { backgroundColor: chipHover } }}
            />
          );
        })}
      </Box>

      <Dialog
        open={lightboxOpen && imageItems.length > 0}
        onClose={() => setLightboxOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { backgroundColor: '#0c0c0c', color: '#fff', position: 'relative' },
        }}
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setLightboxOpen(false)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: '#fff',
              zIndex: 2,
              background: 'rgba(0,0,0,0.35)',
              '&:hover': { background: 'rgba(0,0,0,0.5)' },
            }}
          >
            <CloseIcon />
          </IconButton>

          {imageItems.length > 1 && (
            <IconButton
              onClick={goPrev}
              sx={{
                position: 'absolute',
                top: '50%',
                left: 8,
                transform: 'translateY(-50%)',
                color: '#fff',
                zIndex: 2,
                background: 'rgba(0,0,0,0.35)',
                '&:hover': { background: 'rgba(0,0,0,0.5)' },
              }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>
          )}

          {imageItems.length > 1 && (
            <IconButton
              onClick={goNext}
              sx={{
                position: 'absolute',
                top: '50%',
                right: 8,
                transform: 'translateY(-50%)',
                color: '#fff',
                zIndex: 2,
                background: 'rgba(0,0,0,0.35)',
                '&:hover': { background: 'rgba(0,0,0,0.5)' },
              }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          )}

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#000',
              minHeight: '60vh',
              p: 2,
            }}
          >
            {imageItems[lightboxIndex] && (
              <>
                <Box
                  component="img"
                  src={imageItems[lightboxIndex].fileUrl}
                  alt={imageItems[lightboxIndex].fileName || 'Attachment'}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain',
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, color: '#ccc' }}>
                  {imageItems[lightboxIndex].fileName}
                  {imageItems.length > 1
                    ? ` (${lightboxIndex + 1}/${imageItems.length})`
                    : ''}
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
