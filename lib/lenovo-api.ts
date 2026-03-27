export async function fetchFromBridge<T>(endpoint: string): Promise<T> {
  const url = process.env.LENOVO_API_URL + endpoint;
  const token = process.env.LENOVO_API_TOKEN;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('auth_error');
  }

  if (response.status >= 500) {
    throw new Error('bridge_error');
  }

  if (!response.ok) {
    throw new Error('network_error');
  }

  return response.json();
}
