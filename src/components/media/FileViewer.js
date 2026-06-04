import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useProfile } from "../../context/ProfileContext";
import ZoomableMedia from "./ZoomableMedia";
import { getReadableSize } from "./MediaDesign";

const DOC_VIEWER_BASE = "https://docs.google.com/gview?embedded=true&url=";

const MIME_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
};

const getFileExtension = (uri) => {
  if (!uri) {
    return "";
  }
  const match = String(uri).split("?")[0].match(/\.([^.\/]+)$/);
  return match ? match[1].toLowerCase() : "";
};

const getFileTypeCategory = (extension, contentType) => {
  const type = String(contentType || "").toLowerCase();
  const ext = String(extension || "").toLowerCase();
  const check = `${ext} ${type}`;

  if (check.includes("pdf")) return "pdf";
  if (check.includes("doc") && !check.includes("docx")) return "doc";
  if (check.includes("docx")) return "docx";
  if (check.includes("xls") && !check.includes("xlsx")) return "xls";
  if (check.includes("xlsx")) return "xlsx";
  if (check.includes("ppt") && !check.includes("pptx")) return "ppt";
  if (check.includes("pptx")) return "pptx";
  if (check.includes("txt") || check.includes("text/plain")) return "txt";
  if (check.includes("zip")) return "zip";
  if (check.includes("rar")) return "rar";
  return "unknown";
};

const isPreviewableType = (extension, contentType) => {
  const category = getFileTypeCategory(extension, contentType);
  return ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt"].includes(category);
};

const getDocumentPreviewUrl = (uri, contentType) => {
  if (!uri) {
    return null;
  }

  const extension = getFileExtension(uri);
  const normalizedType = String(contentType || "").toLowerCase();

  if (!isPreviewableType(extension, normalizedType)) {
    return null;
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    if (extension === "pdf") {
      return `${DOC_VIEWER_BASE}${encodeURIComponent(uri)}`;
    }
    // Google Docs can preview most office documents
    return `${DOC_VIEWER_BASE}${encodeURIComponent(uri)}`;
  }

  if (extension === "pdf") {
    return uri;
  }

  return null;
};

const getPdfPreviewHtml = (base64) => {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>body,html{margin:0;padding:0;height:100%;overflow:hidden;background:#000}#pdf-canvas{width:100%;height:100%;}</style>
  </head>
  <body>
    <canvas id="pdf-canvas"></canvas>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.122/pdf.min.js"></script>
    <script>
      const data = atob('${base64}');
      const loadingTask = window.pdfjsLib.getDocument({ data });
      loadingTask.promise.then(function(pdf) {
        pdf.getPage(1).then(function(page) {
          const viewport = page.getViewport({ scale: window.innerWidth / page.getViewport({ scale: 1 }).width });
          const canvas = document.getElementById('pdf-canvas');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const ctx = canvas.getContext('2d');
          page.render({ canvasContext: ctx, viewport: viewport });
        });
      });
    </script>
  </body>
</html>`;
};

const getFileIconAndColor = (extension, contentType) => {
  const category = getFileTypeCategory(extension, contentType);

  const iconMap = {
    pdf: { icon: "document-text", color: "#DC2626", bg: "#FEE2E2" },
    docx: { icon: "document", color: "#2563EB", bg: "#DBEAFE" },
    doc: { icon: "document", color: "#2563EB", bg: "#DBEAFE" },
    xlsx: { icon: "grid", color: "#16A34A", bg: "#DCFCE7" },
    xls: { icon: "grid", color: "#16A34A", bg: "#DCFCE7" },
    pptx: { icon: "easel", color: "#DC2626", bg: "#FFEDD5" },
    ppt: { icon: "easel", color: "#DC2626", bg: "#FFEDD5" },
    txt: { icon: "document-text", color: "#6B7280", bg: "#F3F4F6" },
    zip: { icon: "folder", color: "#F59E0B", bg: "#FEF3C7" },
    rar: { icon: "folder", color: "#F59E0B", bg: "#FEF3C7" },
    unknown: { icon: "document", color: "#8B5CF6", bg: "#F3E8FF" },
  };

  return iconMap[category] || iconMap.unknown;
};

const logDiagnostics = (label, diagnostics) => {
  console.log(`[FileViewer] ${label}:`, {
    fileType: diagnostics.fileType,
    contentType: diagnostics.contentType,
    fileUri: diagnostics.fileUri,
    previewUri: diagnostics.previewUri,
    fileName: diagnostics.fileName,
    reason: diagnostics.reason,
    timestamp: new Date().toISOString(),
  });
};

function ActionButton({ icon, label, onPress, danger = false }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.78}>
      <Ionicons name={icon} size={22} color={danger ? "#FCA5A5" : "#fff"} />
      <Text style={[styles.actionLabel, danger && styles.deleteText]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function FileViewer({
  file,
  visible,
  onClose,
  onDelete,
  getFileUri,
  getFileTitle,
}) {
  const fileUri = file ? getFileUri(file) : null;
  const title = file ? getFileTitle(file) : "Document";
  const canDelete = Boolean(onDelete);

  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { authToken } = useProfile();

  const extension = getFileExtension(fileUri);
  const contentType = String(file?.content_type || file?.mime_type || "").toLowerCase();
  const fileCategory = getFileTypeCategory(extension, contentType);
  const mimeType = MIME_TYPES[extension] || contentType || "application/octet-stream";

  const handleShare = async () => {
    if (!fileUri) return;

    try {
      setIsPreviewLoading(true);
      await Share.share({
        title,
        message: fileUri,
        url: Platform.OS === "ios" ? fileUri : undefined,
      });
    } catch {
      Alert.alert("Share unavailable", "This document could not be shared right now.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleOpen = async () => {
    if (!fileUri) {
      Alert.alert("Open unavailable", "This document could not be opened because the file link is missing.");
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(fileUri);
      if (!canOpen) {
        throw new Error("Unsupported URL");
      }
      await Linking.openURL(fileUri);
    } catch (error) {
      Alert.alert("Open unavailable", "This document cannot be opened on this device.");
      logDiagnostics("Open Error", {
        fileType: fileCategory,
        contentType,
        fileUri,
        previewUri: file?.previewUri,
        fileName: title,
        reason: String(error?.message || "Unable to open URL"),
      });
    }
  };

  const handleDownload = async () => {
    // Implementation for permanent download to device storage would go here
    // using MediaLibrary or Storage Access Framework.
    Alert.alert("Download", "File is being saved to your local cache. Use 'Open' to view it.");
  };

  const iconAndColor = getFileIconAndColor(extension, contentType);

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {fileCategory.toUpperCase()} • {getReadableSize(file)}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={() => onDelete ? onDelete(file) : handleShare()}>
            <Ionicons name={onDelete ? "trash-outline" : "share-social-outline"} size={23} color={onDelete ? "#FCA5A5" : "#fff"} />
          </TouchableOpacity>
        </View>

        {isPreviewLoading ? (
          <View style={[styles.previewContainer, styles.loadingContainer]}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Preparing document...</Text>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <ScrollView
              contentContainerStyle={styles.fallbackContent}
              showsVerticalScrollIndicator={false}
            >
              <ZoomableMedia resetKey={file?.id || file?.file_path || title}>
                <View style={styles.documentPage}>
                  <View
                    style={[
                      styles.documentIcon,
                      { backgroundColor: iconAndColor.bg },
                    ]}
                  >
                    <Ionicons
                      name={iconAndColor.icon}
                      size={54}
                      color={iconAndColor.color}
                    />
                  </View>

                  <Text style={styles.documentTitle} numberOfLines={3}>
                    {title}
                  </Text>

                  {file && (
                    <>
                      <View style={styles.fileInfoRow}>
                        <Ionicons name="document" size={14} color="#9CA3AF" />
                        <Text style={styles.fileInfoText}>
                          {getFileTypeCategory(extension, contentType).toUpperCase()}
                        </Text>
                      </View>

                      {file?.size || file?.file_size ? (
                        <View style={styles.fileInfoRow}>
                          <Ionicons name="create" size={14} color="#9CA3AF" />
                          <Text style={styles.fileInfoText}>
                            {(() => {
                              const bytes = Number(file?.size || file?.file_size || 0);
                              if (bytes < 1024 * 1024) {
                                return `${Math.max(1, Math.round(bytes / 1024))} KB`;
                              }
                              return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                            })()}
                          </Text>
                        </View>
                      ) : null}

                      {file?.created_at || file?.createdAt ? (
                        <View style={styles.fileInfoRow}>
                          <Ionicons name="calendar" size={14} color="#9CA3AF" />
                          <Text style={styles.fileInfoText}>
                            {new Date(file?.created_at || file?.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              </ZoomableMedia>
            </ScrollView>
          </View>
        )}

        <View style={styles.actionBar}>
          <ActionButton icon="open-outline" label="Open With" onPress={handleOpen} />
          <ActionButton icon="download-outline" label="Download" onPress={handleDownload} />
          <ActionButton icon="share-social-outline" label="Share" onPress={handleShare} />
          {canDelete ? (
            <ActionButton
              icon="trash-outline"
              label="Delete"
              onPress={() => {
                Alert.alert("Move to Recycle Bin", "This file will be moved to Recycle Bin.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Move",
                    style: "destructive",
                    onPress: () => {
                      onDelete(file);
                      onClose();
                    },
                  },
                ]);
              }}
              danger
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    position: "absolute",
    top: 36,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 2,
    color: "#D1D5DB",
    fontSize: 11,
    fontWeight: "500",
  },
  previewContainer: {
    flex: 1,
    marginTop: 36,
    marginBottom: 68,
    backgroundColor: "#000",
  },
  fallbackContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  loadingSpinner: {
    marginBottom: 12,
  },
  webview: {
    flex: 1,
  },
  documentPage: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  documentIcon: {
    width: 100,
    height: 100,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  documentTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  fileInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 200,
  },
  fileInfoText: {
    marginLeft: 8,
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "500",
  },
  previewHint: {
    marginTop: 24,
    color: "#9CA3AF",
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
  },
  retryButton: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  actionLabel: {
    marginTop: 4,
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  deleteText: {
    color: "#FCA5A5",
  },
});
