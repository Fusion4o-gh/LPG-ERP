const fs = require("node:fs");

function normalizeReadlinkError(error, path) {
  if (!error || error.code !== "EISDIR") {
    return error;
  }

  try {
    const stat = fs.lstatSync(path);
    if (stat.isSymbolicLink()) {
      return error;
    }
  } catch {
    return error;
  }

  error.code = "EINVAL";
  error.message = error.message.replace("EISDIR", "EINVAL");
  return error;
}

const originalReadlink = fs.readlink;
fs.readlink = function patchedReadlink(path, options, callback) {
  if (typeof options === "function") {
    return originalReadlink.call(this, path, (error, linkString) => {
      options(normalizeReadlinkError(error, path), linkString);
    });
  }

  return originalReadlink.call(this, path, options, (error, linkString) => {
    callback(normalizeReadlinkError(error, path), linkString);
  });
};

const originalReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function patchedReadlinkSync(path, options) {
  try {
    return originalReadlinkSync.call(this, path, options);
  } catch (error) {
    throw normalizeReadlinkError(error, path);
  }
};

const originalPromisesReadlink = fs.promises.readlink.bind(fs.promises);
fs.promises.readlink = async function patchedPromisesReadlink(path, options) {
  try {
    return await originalPromisesReadlink(path, options);
  } catch (error) {
    throw normalizeReadlinkError(error, path);
  }
};
