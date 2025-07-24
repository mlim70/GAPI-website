// frontend/src/api/auth.ts
const API = 'http://localhost:4000';

async function request<R = unknown>(
  path: string,
  options: RequestInit & { json?: any; formData?: FormData } = {}
): Promise<R> {
  const headers = options.formData
    ? {}
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const body = options.formData
    ? options.formData
    : JSON.stringify(options.json ?? {});

  const res = await fetch(`${API}${path}`, { ...options, headers, body });

  if (!res.ok) throw new Error((await res.json()).message ?? res.statusText);
  return res.json();
}

export const authApi = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    levelKey: string;
    profilePic?: File | null;
  }) => {
    if (data.profilePic) {
      // multipart
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) =>
        v != null ? fd.append(k, v as string | Blob) : void 0
      );
      return request<{ token: string; user: any }>('/api/auth/register', {
        method: 'POST',
        formData: fd,
      });
    }
    // plain JSON
    return request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      json: data,
    });
  },

  login: (data: { identifier: string; password: string }) =>
    request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      json: data,
    }),
};
