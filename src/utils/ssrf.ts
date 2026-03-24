export const isUrlAllowed = (url: string) => {
  try {
    const parsed = new URL(url)
    
    // Allowlist schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    // Block localhost and private IPs
    const hostname = parsed.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false
    }

    const privateIpRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/
    if (privateIpRegex.test(hostname)) {
      return false
    }
    
    // Local / private IP v6 check (simplified)
    if (hostname.startsWith('fd') || hostname.startsWith('fe80')) {
      return false
    }

    return true
  } catch (e) {
    return false
  }
}

export const safeFetch = async (url: string, options: RequestInit = {}) => {
  if (!isUrlAllowed(url)) {
    throw new Error('SSRF attempt blocked')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'manual', // handle redirects manually to limit to 5
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

export const safeFetchWithRedirects = async (url: string, options: RequestInit = {}, maxRedirects = 5): Promise<Response> => {
    let currentUrl = url;
    for (let i = 0; i <= maxRedirects; i++) {
        const response = await safeFetch(currentUrl, options);
        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
            const location = response.headers.get('location')!;
            currentUrl = new URL(location, currentUrl).toString();
            if (!isUrlAllowed(currentUrl)) {
                 throw new Error('Redirect SSRF attempt blocked');
            }
        } else {
            return response;
        }
    }
    throw new Error('Too many redirects');
}
