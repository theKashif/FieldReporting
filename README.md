# Field Reporting App

> **Mobile Engineering Technical Assessment**  
> An offline-first React Native mobile application designed for field inspectors filing photo reports over hostile, unstable, and 2G network environments.

---

## 1. Executive Summary & Philosophy

Field workers frequently operate in remote sites where connectivity is poor (2G speeds), intermittent, or absent for hours at a time. The core mission of this application is **guaranteed delivery with zero data loss and exactly-once submission**:

1. **Compose**: Capture or select 1 to 5 photos (from camera or gallery) with a short description.
2. **Deliver**: Unattended background upload queue surviving dropped connections, force-quits, and system reboots.
3. **Review**: Real-time review of submissions retrieved directly from the server (not read back from local state).
4. **Start Over**: A deliberate reset function with a clearly defined and documented blast radius.

### Key Constraints Satisfied
- **1–5 Images Bound**: Strictly enforced at composition, storage, and server ingestion.
- **5 MB Ceiling**: Guaranteed compression ceiling. Camera originals straight off modern 100MP+ sensors (15–20 MB) are automatically compressed in progressive resolution/quality tiers to land strictly under 5 MB without degrading fidelity.
- **2G Network Resilience**: Requests are dispatched sequentially over FIFO queues with 120-second timeouts, exponential backoff, and automatic network reconnection listeners.
- **Idempotency & Exactly-Once Delivery**: Client-generated UUIDv4 tokens ensure that repeated retry attempts across connection drops never produce duplicate records on the server.
- **Backend Failure on Demand**: Built-in chaos engine supporting programmatic latency, dropped sockets, server errors (500), and rate limiting (429).

---

## 2. Architecture & System Design

```
+-----------------------------------------------------------------------------------+
|                                 REACT NATIVE CLIENT                               |
|                                                                                   |
|  +---------------------+      +------------------------+                          |
|  |   UI Components     | ---> | Progressive Compressor |                          |
|  | (Compose / Review)  |      | (@react-native-        |                          |
|  +----------+----------+      |  compressor)           |                          |
|             |                 +-----------+------------+                          |
|             v                             |                                       |
|  +---------------------+                  v                                       |
|  | Local Sandboxed     | <----------------+                                       |
|  | Storage             |                                                          |
|  | (report-images/)    |                                                          |
|  +----------+----------+                                                          |
|             |                                                                     |
|             v                                                                     |
|  +-------------------------------------+      +--------------------------------+  |
|  | Fast SQLite Database Layer          | <--> | Detached Queue Worker Loop     |  |
|  | (@op-engineering/op-sqlite)         |      | - FIFO sequential processing   |  |
|  | - reports (id, status, retry_count) |      | - Exponential backoff + jitter |  |
|  | - report_images (report_id, uri)    |      | - NetInfo reconnect listener   |  |
|  +-------------------------------------+      +---------------+----------------+  |
+---------------------------------------------------------------|-------------------+
                                                                | Multipart / FormData
                                                                | (reportId, description, images)
                                                                v
+-----------------------------------------------------------------------------------+
|                              EXPRESS / MONGO BACKEND                              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Chaos Middleware (/api/chaos & x-chaos-* headers)                           |  |
|  | (Simulates: delay, drop socket, 500 error, 429 rate limit)                   |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         |                                         |
|                                         v                                         |
|  +--------------------------------------+--------------------------------------+  |
|  | Multer Disk Storage (/uploads)                                              |  |
|  +--------------------------------------+--------------------------------------+  |
|                                         |                                         |
|                                         v                                         |
|  +-----------------------------------------------------------------------------+  |
|  | Reports Service (Atomic Upsert on reportId)                                 |  |
|  | - Idempotency guaranteed via MongoDB unique index on reportId               |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### Layer Breakdown

1. **Presentation & Decomposed UI Layer** (`src/screens/` & `src/components/`):
   - Fast, non-blocking UI. The compose action takes user inputs and persists them immediately to local storage.
   - Decomposed into isolated, memoized subcomponents (`ReportComposeForm`, `PendingReportsList`, `SubmittedReportsList`, `StartOverSection`) with `React.memo` to eliminate unnecessary re-renders when the user types in text inputs.
   - Decoupled state, database querying, and background worker synchronization into a dedicated `useReports` custom hook (`src/hooks/useReports.ts`).
   - The UI never waits for network I/O to confirm report creation.

2. **Progressive Compression Engine** (`src/services/imageStorageService.ts`):
   - In field conditions, camera photos can easily exceed 15–20 MB.
   - Rather than naive downscaling, images pass through a multi-stage compression ladder (`2560px @ 85%`, `2200px @ 80%`, `1920px @ 75%`, down to `1024px @ 50%`) until the output file size strictly satisfies `size < 5 MB`.
   - Processed files are copied into the app's isolated `DocumentDir/report-images/` directory so that gallery deletions by the user or OS cache purges cannot invalidate pending uploads.

3. **Persistent SQLite Store** (`src/database/` & `src/repositories/`):
   - Powered by `@op-engineering/op-sqlite` for high-throughput synchronous SQLite bindings via JSI.
   - State machine: `pending` -> `uploading` -> `uploaded` (or `failed` after max retries).
   - If the app process is killed mid-upload, any report stuck in `uploading` is automatically reset to `pending` on restart.

4. **Detached Upload Queue Worker** (`src/workers/uploadQueueWorker.ts`):
   - Operates independently of screen mounts or React component lifecycles.
   - Strictly FIFO: On 2G networks, parallel uploads saturate bandwidth and lead to cascading socket timeouts. Processing reports one at a time preserves throughput and maximizes the odds of each individual report landing.
   - Network event awareness: Listens for `@react-native-community/netinfo` state changes. When connection drops, uploading pauses; when connection returns, backoff timers are cleared and the queue awakens instantly.
   - Exponential backoff with jitter prevents thundering-herd problems against an intermittently available server.

5. **Server Layer & Deduplication** (`server/src/`):
   - Express TypeScript API with MongoDB persistence and Multer file storage.
   - Every report submission includes a client-generated `reportId` UUID.
   - `Report.findOneAndUpdate({ reportId }, ..., { upsert: true })` ensures that even if an upload succeeds on the server but the connection drops before the 200 OK arrives at the client, the subsequent client retry is completely idempotent.

---

### Codebase Structure

```text
FieldReporting/
├── android/                         # Android native project files
│   └── local.properties.example     # SDK path template for reviewers
├── server/                          # Express + TypeScript backend
│   ├── src/
│   │   ├── config/database.ts       # MongoDB connection with zero-config fallback
│   │   ├── controllers/             # Report & reset controllers
│   │   ├── middleware/chaos.ts      # Failure on Demand (drop, delay, 500, 429)
│   │   ├── routes/                  # /api/reports and /api/chaos endpoints
│   │   └── app.ts                   # Express server entry point
│   ├── uploads/                     # Upload destination (disk storage)
│   └── .env.example                 # Backend environment template
├── src/                             # React Native client
│   ├── components/
│   │   ├── ChaosControlPanel.tsx    # In-app failure simulator panel
│   │   ├── ImagePreviewModal.tsx    # Full-screen image inspector
│   │   ├── PendingReportsList.tsx   # Offline SQLite queue list (memoized)
│   │   ├── ReportComposeForm.tsx    # Compose form & attachments (memoized)
│   │   ├── ReportImageItem.tsx      # Thumbnail item with size & mimeType
│   │   ├── StartOverSection.tsx     # Deliberate reset trigger (memoized)
│   │   └── SubmittedReportsList.tsx # Live server-fetched reports (memoized)
│   ├── hooks/
│   │   └── useReports.ts            # Data fetching, worker lifecycle & syncing hook
│   ├── repositories/
│   │   └── reportRepository.ts      # SQLite CRUD operations
│   ├── services/
│   │   ├── chaosService.ts          # Chaos simulation API client
│   │   ├── imageStorageService.ts   # Progressive compression ladder (< 5 MB)
│   │   ├── reportApiService.ts      # Server reports & reset API calls
│   │   ├── reportService.ts         # Local report creation orchestrator
│   │   └── reportUploadService.ts   # Multipart upload with 120s timeout
│   ├── workers/
│   │   └── uploadQueueWorker.ts     # Detached FIFO upload queue engine
│   └── screens/
│       └── CreateReportScreen.tsx   # High-level clean screen orchestrator
└── README.md                        # Documentation & reviewer guide
```

---

## 3. Getting Started & Running the Project

Follow these simple steps to run the complete stack locally.

### Prerequisites

1. **Node.js**: v18 or higher (`node -v`)
2. **Local MongoDB**: Running on port `27017` (default connection: `mongodb://127.0.0.1:27017/field-reporting`).
   - **Option A (Docker - Instant)**:
     ```bash
     docker run -d -p 27017:27017 --name local-mongo mongo:latest
     ```
   - **Option B (Native Install / Service)**:
     - **macOS (Homebrew)**: `brew services start mongodb-community`
     - **Linux (systemd)**: `sudo systemctl start mongod`
     - **Windows**: Start the MongoDB service in Windows Services, or run `mongod` from your terminal.
   - *Note: If using MongoDB Atlas or a custom port, simply set `MONGODB_URI` in `server/.env`.*
3. **Android Environment**:
   - Android Studio with Android SDK installed.
   - A connected physical Android device (with USB debugging enabled) or an Android Emulator running.

---

### Step 1: Start the Backend Server (Terminal 1)

```bash
cd server
npm install

# Optional: copy example env (defaults automatically to port 5000 & local MongoDB if omitted)
cp .env.example .env

# Start server in watch mode:
npm run dev
```
The server will output:
```text
MongoDB connected successfully.
Server is running on port 5000
```

---

### Step 2: Route Device Traffic to Host (Terminal 2)

When running on a physical Android phone or an emulator, port 5000 must be routed to your development machine:

```bash
# 1. Verify your device/emulator is recognized:
adb devices

# 2. Reverse forward port 5000:
adb reverse tcp:5000 tcp:5000
```
> **Note**: `adb reverse` allows the Android app running on the phone to connect directly to `http://localhost:5000` on your computer.

---

### Step 3: Run the React Native Mobile App (Terminal 3)

From the project root:

```bash
# 1. Install dependencies
npm install

# 2. Android SDK check (Only if needed):
# If Gradle reports "SDK location not found", copy the sample file:
#   Windows: copy android\local.properties.example android\local.properties
#   macOS/Linux: cp android/local.properties.example android/local.properties
# Then verify that sdk.dir points to your local Android SDK.

# 3. Start Metro bundler
npm start

# 4. In a separate terminal, compile and launch on Android:
npm run android
```

---

### Troubleshooting for Reviewers

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **`SDK location not found`** | Gradle cannot find the Android SDK path | Copy `android/local.properties.example` to `android/local.properties` and ensure `sdk.dir` matches your Android SDK path. |
| **`Network request failed` / Simulator shows `● Offline`** | The phone cannot reach the host server | Run `adb reverse tcp:5000 tcp:5000` while your phone is plugged in. Ensure `npm run dev` in the `server` folder is running. |
| **`MongoDB connection error`** | Local MongoDB service is not started | Start your local MongoDB (`mongod` / MongoDB Compass) or put a remote MongoDB Atlas URI in `server/.env`. |
| **Multer / upload permissions** | Uploads directory does not exist | The server automatically creates `server/uploads/temp/` on startup with full permissions. |

---

## 4. Failure on Demand (Chaos Engineering)

To prove that the delivery pipeline survives all failure modes, the backend comes equipped with an on-demand chaos simulation engine (`server/src/middleware/chaos.ts`).

### Available Simulation Modes

| Mode | Behavior | Real-World Analog |
| :--- | :--- | :--- |
| `delay` | Injects artificial latency before responding | 2G/EDGE network latency |
| `drop` | Destroys the TCP socket immediately | Cell tower handover, tunnel outage |
| `error` | Responds with HTTP 500 Internal Server Error | Server degradation, database outage |
| `rate_limit` | Responds with HTTP 429 Too Many Requests | API gateway throttling |

Evaluators can trigger chaos either globally (via stateful API) or per-request (via HTTP headers):

---

### Method A: In-App Simulator Panel (Easiest & Recommended)

The mobile app includes a built-in **🛠️ Failure & Chaos Simulator** panel directly at the top of the main screen:
- Tap on the simulator card to expand it.
- Tap **Drop Connection** (⚡) to make the server immediately destroy incoming sockets.
- Tap **500 Server Error** (💥) to make the server respond with HTTP 500.
- Tap **2G Latency** (🐌) to inject a 15-second response delay.
- Tap **Rate Limit** (🔒) to return HTTP 429.
- Tap **Normal (Healthy)** (🟢) to restore normal operations.

---

### Method B: Terminal / API Control (cURL)

You can also set the chaos mode directly using `curl` against the backend:

#### 1. Drop Connections (Socket Reset)
```bash
curl -X POST http://localhost:5000/api/chaos \
  -H "Content-Type: application/json" \
  -d '{"mode": "drop"}'
```
*Expected App Behavior:* The mobile queue catches the dropped socket, marks the report as failed with an exponential retry timestamp, and automatically retries when the server recovers.

#### 2. High Latency (Simulate 2G Link)
```bash
curl -X POST http://localhost:5000/api/chaos \
  -H "Content-Type: application/json" \
  -d '{"mode": "delay", "delayMs": 15000}'
```
*Expected App Behavior:* The report remains in `↑ Uploading...` status until the transfer finishes. The 120s timeout budget accommodates the high delay.

#### 3. Server Errors (500 Internal Server Error)
```bash
curl -X POST http://localhost:5000/api/chaos \
  -H "Content-Type: application/json" \
  -d '{"mode": "error", "statusCode": 500, "message": "Simulated upstream failure"}'
```
*Expected App Behavior:* The client captures the 500 response, increments retry counters, and schedules the next retry with jitter.

#### 4. Rate Limiting (429 Too Many Requests)
```bash
curl -X POST http://localhost:5000/api/chaos \
  -H "Content-Type: application/json" \
  -d '{"mode": "rate_limit", "retryAfterSeconds": 30}'
```

#### 5. Reset Chaos to Normal Operation
```bash
curl -X POST http://localhost:5000/api/chaos/reset
```

---

### Method C: Physical & OS-Level Stress Testing

1. **Airplane Mode Test**:
   - Compose a report with 5 photos and tap **Save Report**.
   - Immediately switch phone into **Airplane Mode**.
   - Note that the status displays "Waiting to upload".
   - Turn Airplane Mode **OFF**.
   - NetInfo triggers immediately; the queue wakes up and lands the report without user intervention.

2. **Force-Quit Mid-Flight Test**:
   - Save a report.
   - While the card displays `↑ Uploading...`, swipe the app away from the Android Recent Apps / task switcher.
   - Reopen the app.
   - On startup, the queue worker discovers the interrupted upload, resets it from `uploading` to `pending`, and successfully completes the transfer.

3. **Server Death Mid-Upload**:
   - Stop the backend process (`Ctrl + C`) while an upload is underway.
   - Restart the server (`npm run dev`).
   - The queue worker retries and delivers the report. Due to the atomic `reportId` deduplication, no duplicates are created.

---

## 5. "Start Over" (Deliberate Reset & Blast Radius)

The brief requires a deliberate reset with a clearly defined blast radius:

> *"A deliberate reset. You decide how far the blast radius goes, and say so."*

In this application, **Start Over** is available directly on the main screen and offers an explicit choice of blast radius via confirmation dialog:

### Blast Radius Levels

```
                   +------------------------------------+
                   |         Start Over Trigger         |
                   +-----------------+------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
    [Option 1: Local Queue Only]              [Option 2: Full System Reset]
    +------------------------------+          +------------------------------+
    | Local SQLite Tables Wiped    |          | Local SQLite Tables Wiped    |
    | Local report-images/ Deleted |          | Local report-images/ Deleted |
    | Server Reports UNTOUCHED     |          | Server DB Collection Dropped |
    |                              |          | Server /uploads/ Purged      |
    +------------------------------+          +------------------------------+
```

1. **Option 1: Local Queue Only (Default Field Worker Reset)**
   - **What gets wiped**: The local SQLite `reports` and `report_images` tables are wiped. The local cached compressed images in `DocumentDir/report-images/` are unlinked.
   - **What is preserved**: All submitted reports on the server remain intact and visible in the Review section.
   - **Use case**: A field worker made an error on an offline report that has not yet uploaded and wants to clear the pending queue on their device without affecting past submitted work.

2. **Option 2: Full Reset (Device + Server Wipe)**
   - **What gets wiped**: The local device queue and cache are wiped, and a `POST /api/reports/reset` request is sent to the server. The server drops all MongoDB report documents and unlinks all files in `server/uploads/`.
   - **Use case**: Evaluators, QA testers, and developers who need to return the entire system to a pristine, clean-slate state before beginning a new test scenario.

---

## 6. Deliberate Design Decisions & Trade-Offs

| Decision | Alternative Considered | Why We Chose This Path |
| :--- | :--- | :--- |
| **Progressive Compression Ladder** | Fixed 50% resize on all images | Large 18 MB camera originals straight off modern phone sensors can fail fixed compression. A multi-tier ladder (`2560px` down to `1024px`) guarantees the file lands strictly under 5 MB while retaining high diagnostic visual detail. |
| **Sequential FIFO Uploads** | Concurrent multi-report uploads | On 2G (often ~50 kbps with packet drop), uploading 3 reports concurrently splits the already tiny bandwidth, causing all three connections to hit read timeouts. Sequential uploads guarantee forward progress. |
| **Local Sandboxed Image Storage** | Referencing raw camera/gallery URIs | Temporary URIs (`content://` or cache files) can be reclaimed by Android or deleted by the user while the report waits in the offline queue. Copying compressed files to `report-images/` guarantees local persistence across reboots. |
| **Client-Side `reportId` UUID** | Server-assigned auto-increment ID | If an upload succeeds on the server but the TCP ACK is lost on a flaky network, a client retry would create a duplicate record. With a client-generated UUID, the server performs an atomic upsert on `reportId`, ensuring exactly-once semantics. |
| **Review Fetched From Server** | Reading local `uploaded` SQLite rows | The brief mandates: *"Show what the server holds — fetched from it, not read back out of local state."* The "Submitted Reports" list is fetched directly via `GET /api/reports`. Local rows are used only for offline queue tracking. |

---

## 7. What Was Knowingly Left Out (Scope Discipline)

Per the brief's instruction:
> *"No login, no push notifications, no comments, no map, no video, no editing an already-uploaded report. We would rather see the upload path finished to production standard than six features done thinly."*

We strictly adhered to this boundary:
- **No authentication / user management**: The inspector is pre-identified.
- **No background push notifications**: Upload queue is driven by internal worker loops and NetInfo triggers.
- **No map / GPS geolocation**: Kept the UI uncluttered and focused entirely on the 5-photo upload pipeline.
- **No editing existing reports**: Once received by the server, records are immutable (consistent with inspection audit logs).

---

## 8. What I Would Do With Another Day

1. **Tus / Resumable Byte-Range Chunking**:
   - For even harsher networks (e.g. sub-2G speeds where even a 3 MB file cannot complete in a single uninterrupted connection window), implement chunked resumable uploads using the `tus` protocol or presigned S3 multipart uploads.
2. **Android Foreground Service / WorkManager**:
   - While the current worker loop survives app restarts and NetInfo events, registering a native Android `WorkManager` task or Foreground Service notification would allow uploads to proceed even when the user has placed the app in the background for hours.
3. **Optimized Thumbnail Cache**:
   - Implement localized LRU caching for thumbnails on the Review section to minimize data consumption when viewing previously submitted reports on 2G.

---

## 9. Verification & Test Checklist

- [x] **1–5 Photos bounded**: Cannot submit 0 photos; cannot pick or shoot > 5 photos.
- [x] **Non-blank description required**: Validated before storage.
- [x] **5 MB Ceiling**: Evaluated with camera photos up to 18 MB. All stored and uploaded files measure under 5 MB.
- [x] **survives Force-Quit**: Stored in persistent SQLite; resumed seamlessly on next launch.
- [x] **Survives Network Loss**: NetInfo detects disconnection and pauses; reconnect instantly resumes.
- [x] **Survives Server Errors**: Retries with exponential backoff on 500, 429, and socket drops.
- [x] **Exactly-once Delivery**: Zero duplicate records in MongoDB despite simulated retries.
- [x] **Review Screen**: Fetched live from `GET /api/reports` with image dimensions, MIME type, and preview modal.
- [x] **Start Over**: Modal prompt with dual-level blast radius (Local vs. Full System).
- [x] **Modular & Decoupled UI**: Screen decomposed into memoized subcomponents (`ReportComposeForm`, `PendingReportsList`, `SubmittedReportsList`, `StartOverSection`) and an isolated `useReports` custom hook.
- [x] **Typecheck Clean**: Both mobile client (`npx tsc --noEmit`) and server pass with 0 errors.
