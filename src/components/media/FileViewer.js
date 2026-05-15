import React, { useEffect, useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import { useProfile } from "../../context/ProfileContext";
import ZoomableMedia from "./ZoomableMedia";

const DOC_VIEWER_BASE = "https://docs.google.com/gview?embedded=true&url=";
const getFileExtension = (uri) => {
  if (!uri) {
    return "";
  }
  const match = uri.match(/\.([^.?#\\/]+)(?:[?#]|$)/);
  return match ? match[1].toLowerCase() : "";
};

const getDocumentPreviewUrl = (uri, contentType) => {
  if (!uri) {
    return null;
  }

  const normalizedType = String(contentType || "").toLowerCase();
  const extension = getFileExtension(uri);
  const previewableExtensions = [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
  ];

  const isPreviewableByType = previewableExtensions.some((item) => normalizedType.includes(item));
  const isPreviewableByExt = previewableExtensions.includes(extension);

  if (!isPreviewableByType && !isPreviewableByExt) {
    return null;
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    if (extension === "pdf") {
      return `${DOC_VIEWER_BASE}${encodeURIComponent(uri)}`;
    }
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

  const handleShare = async () => {
    if (!fileUri) {
      return;
    }

    try {
      await Share.share({
        title,
        message: fileUri,
        url: Platform.OS === "ios" ? fileUri : undefined,
      });
    } catch {
      Alert.alert("Share unavailable", "This document could not be shared right now.");
    }
  };

  const [webViewSource, setWebViewSource] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const { authToken } = useProfile();

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
    } catch {
      Alert.alert("Open unavailable", "This document cannot be opened on this device.");
    }
  };

  useEffect(() => {
    let active = true;
    setPreviewError(null);
    setWebViewSource(null);

    const loadPreview = async () => {
      if (!fileUri) {
        setPreviewError("No file link available for preview.");
        return;
      }

      const extension = getFileExtension(fileUri);
      const normalizedType = String(file?.content_type || "").toLowerCase();
      const isPdf = normalizedType.includes("pdf") || extension === "pdf";
      const previewUrl = getDocumentPreviewUrl(fileUri, file?.content_type);

      if (!previewUrl) {
        setPreviewError("No preview available for this file type.");
        return;
      }

      setIsPreviewLoading(true);
      try {
        if (isPdf && previewUrl.startsWith(DOC_VIEWER_BASE)) {
          setWebViewSource({ uri: previewUrl });
        } else if (isPdf && fileUri.startsWith("http://") || isPdf && fileUri.startsWith("https://")) {
          const fileName = `preview-${file?.id || Date.now()}.${extension || "pdf"}`;
          const localPath = `${FileSystem.cacheDirectory}${fileName}`;
          const downloadOptions = {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          };
          const result = await FileSystem.downloadAsync(fileUri, localPath, downloadOptions);
          const pdfUri = result.uri;

          if (Platform.OS === "android") {
            const pdfData = await FileSystem.readAsStringAsync(pdfUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            setWebViewSource({ html: getPdfPreviewHtml(pdfData) });
          } else {
            setWebViewSource({ uri: pdfUri });
          }
        } else {
          setWebViewSource({ uri: previewUrl });
        }
      } catch (error) {
        setPreviewError("PDF preview unavailable. Use Open to view in an external app.");
      } finally {
        if (active) {
          setIsPreviewLoading(false);
        }
      }
    };

    loadPreview();
    return () => {
      active = false;
    };
  }, [fileUri, file?.content_type, authToken]);

  const canPreview = Boolean(webViewSource);

  const handleDelete = () => {
    if (!file || !onDelete) {
      return;
    }

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
  };

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
              {file?.content_type || "Document"}
            </Text>
          </View>

          <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={23} color="#fff" />
          </TouchableOpacity>
        </View>

        {isPreviewLoading ? (
          <View style={[styles.previewContainer, styles.loadingContainer]}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading preview...</Text>
          </View>
        ) : canPreview ? (
          <View style={styles.previewContainer}>
            <WebView
              source={webViewSource}
              style={styles.webview}
              startInLoadingState
              renderLoading={() => (
                <ActivityIndicator
                  style={styles.loadingSpinner}
                  size="large"
                  color="#fff"
                />
              )}
            />
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <ZoomableMedia resetKey={file?.id || file?.file_path || title}>
              <View style={styles.documentPage}>
                <View style={styles.documentIcon}>
                  <Ionicons name="document-text" size={54} color="#2563EB" />
                </View>
                <Text style={styles.documentTitle} numberOfLines={3}>
                  {title}
                </Text>
                <Text style={styles.documentMeta} numberOfLines={2}>
                  {file?.content_type || "File"}
                </Text>
                <Text style={styles.previewHint}>
                  {previewError || "No preview available"}
                </Text>
              </View>
            </ZoomableMedia>
          </View>
        )}

        <View style={styles.actionBar}>
          <ActionButton icon="open-outline" label="Open" onPress={handleOpen} />
          <ActionButton icon="share-social-outline" label="Share" onPress={handleShare} />
          {canDelete ? (
            <ActionButton icon="trash-outline" label="Delete" onPress={handleDelete} danger />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const ActionButton = ({ icon, label, onPress, danger }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.78}>
    <Ionicons name={icon} size={22} color={danger ? "#FCA5A5" : "#fff"} />
    <Text style={[styles.actionLabel, danger && styles.deleteText]}>{label}</Text>
  </TouchableOpacity>
);

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
    fontSize: 12,
  },
  documentPage: {
    width: "78%",
    minHeight: "58%",
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  documentIcon: {
    width: 112,
    height: 112,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },
  documentTitle: {
    marginTop: 22,
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  documentMeta: {
    marginTop: 8,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  previewContainer: {
    flex: 1,
    marginTop: 90,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 90,
    backgroundColor: "#000",
  },
  loadingText: {
    marginTop: 16,
    color: "#fff",
    fontSize: 14,
  },
  previewHint: {
    marginTop: 18,
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
  },
  loadingSpinner: {
    flex: 1,
    alignSelf: "center",
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 5,
    minHeight: 72,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0,0,0,0.62)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  actionButton: {
    width: 86,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  deleteText: {
    color: "#FCA5A5",
  },
});
