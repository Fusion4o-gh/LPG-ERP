import fs from "fs";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { serviceError } from "../../../../../server/api/responses.ts";
import { getBackupDownloadPath } from "../../../../../server/services/backup/database-backup.ts";

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { filename } = await params;
    const filepath = await getBackupDownloadPath(context, filename);

    const stat = fs.statSync(filepath);
    const stream = fs.createReadStream(filepath);
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(stat.size),
      },
    });
  } catch (error) {
    return serviceError(error);
  }
}
