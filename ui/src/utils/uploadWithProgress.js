/**
 * POST a FormData payload via XHR so we get upload progress events.
 * fetch() does not expose upload progress, so XHR is required here.
 *
 * @param {string}   url
 * @param {FormData} formData
 * @param {(pct: number) => void} onProgress  called with 0-100
 * @returns {Promise<object>}  resolves with parsed JSON body
 */
export function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () => {
      let body;
      try { body = JSON.parse(xhr.responseText); } catch { body = { error: xhr.statusText }; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(body);
    });

    xhr.addEventListener('error', () => reject({ error: 'Network error' }));
    xhr.send(formData);
  });
}
