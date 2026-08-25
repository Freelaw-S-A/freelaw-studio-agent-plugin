---
name: documentos
description: Upload and confirm files on a Freelaw Studio OS. Use for enviar documento, upload, or anexar arquivo.
---

# Documentos

1. `office.documents.createUploadUrl` with the target OS and filename.
2. PUT the bytes to the signed `uploadUrl` using the returned method and headers.
3. `office.documents.confirmUpload` before any petition generate.
4. Never log `uploadUrl`, storage paths, or file contents.
5. Report `attachedFileId` and the next verified step, not the signed URL.
