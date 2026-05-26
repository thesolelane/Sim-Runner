import { logger } from "./logger";

interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
  type: 'residential' | 'mobile' | 'isp';
}

export class ProxyRotator {
  private pools: Map<string, ProxyConfig> = new Map();

  constructor() {
    if (process.env.LITPORT_RESIDENTIAL_USER && process.env.LITPORT_RESIDENTIAL_PASS) {
      this.pools.set('residential', {
        server: `http://${process.env.LITPORT_RESIDENTIAL_HTTP_HOST}:${process.env.LITPORT_RESIDENTIAL_HTTP_PORT}`,
        username: process.env.LITPORT_RESIDENTIAL_USER,
        password: process.env.LITPORT_RESIDENTIAL_PASS,
        type: 'residential',
      });
      logger.info("Residential proxy pool initialized");
    }

    if (process.env.LITPORT_MOBILE_USER && process.env.LITPORT_MOBILE_PASS) {
      this.pools.set('mobile', {
        server: `http://${process.env.LITPORT_MOBILE_HTTP_HOST}:${process.env.LITPORT_MOBILE_HTTP_PORT}`,
        username: process.env.LITPORT_MOBILE_USER,
        password: process.env.LITPORT_MOBILE_PASS,
        type: 'mobile',
      });
      logger.info("Mobile proxy pool initialized");
    }
  }

  getProxy(accountId: number, useCase: 'signup' | 'login' | 'social' | 'strict'): ProxyConfig | undefined {
    let proxyType: 'residential' | 'mobile';
    
    switch (useCase) {
      case 'strict': proxyType = 'mobile'; break;
      default: proxyType = 'residential';
    }

    const proxy = this.pools.get(proxyType);
    if (!proxy) {
      logger.warn({ useCase, proxyType, accountId }, "Proxy not available");
      return undefined;
    }

    logger.info({ accountId, useCase, proxyType }, "Proxy assigned");
    return proxy;
  }
}

export const proxyRotator = new ProxyRotator();
