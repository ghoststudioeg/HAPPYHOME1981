import React, { useEffect } from 'react';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  canonicalUrl?: string;
  price?: number;
  currency?: string;
  availability?: 'in stock' | 'out of stock' | 'preorder' | string;
  type?: 'website' | 'product' | 'article';
  siteName?: string;
  noIndex?: boolean;
}

export function SEO({ 
  title, 
  description, 
  image, 
  url, 
  canonicalUrl,
  price, 
  currency = 'EGP', 
  availability = 'in stock',
  type = 'website',
  siteName = 'متجر البيت السعيد 1981',
  noIndex = false
}: SEOProps) {
  useEffect(() => {
    // 1. Update Title
    const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
    document.title = fullTitle;

    // Helper to update or create meta tags
    const updateMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      let tag = document.querySelector(`meta[${attr}="${name}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attr, name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Helper to update or create link tags (e.g. canonical)
    const updateLink = (rel: string, href: string) => {
      let tag = document.querySelector(`link[rel="${rel}"]`);
      if (!tag) {
        tag = document.createElement('link');
        tag.setAttribute('rel', rel);
        document.head.appendChild(tag);
      }
      tag.setAttribute('href', href);
    };

    // 2. Robots
    if (noIndex) {
      updateMeta('robots', 'noindex, nofollow');
    } else {
      updateMeta('robots', 'index, follow');
    }

    // 3. Description
    if (description) {
      updateMeta('description', description);
      updateMeta('og:description', description, 'property');
      updateMeta('twitter:description', description);
    }

    // 4. Open Graph & Twitter Basics
    updateMeta('og:title', fullTitle, 'property');
    updateMeta('twitter:title', fullTitle);
    updateMeta('og:type', type, 'property');
    updateMeta('og:site_name', siteName, 'property');
    updateMeta('twitter:card', 'summary_large_image');

    // 5. Image (Use actual image; fallback to site logo only if missing)
    const finalImage = image || '/logo-square.svg';
    const absoluteImage = finalImage.startsWith('http') 
      ? finalImage 
      : `${window.location.origin}${finalImage}`;

    updateMeta('og:image', absoluteImage, 'property');
    updateMeta('twitter:image', absoluteImage);

    // 6. Canonical and Page URL
    const finalCanonical = canonicalUrl || url || window.location.href.split('?')[0];
    updateLink('canonical', finalCanonical);
    updateMeta('og:url', finalCanonical, 'property');

    // 7. Product specific metadata
    if (type === 'product' && typeof price === 'number') {
      updateMeta('product:price:amount', price.toString(), 'property');
      updateMeta('product:price:currency', currency, 'property');
      updateMeta('og:price:amount', price.toString(), 'property');
      updateMeta('og:price:currency', currency, 'property');
      updateMeta('product:availability', availability, 'property');

      // 8. JSON-LD structured data for rich Google previews
      let scriptTag = document.querySelector('script#product-schema-jsonld') as HTMLScriptElement | null;
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = 'product-schema-jsonld';
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      const schemaData = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: title,
        image: [absoluteImage],
        description: description || title,
        offers: {
          '@type': 'Offer',
          url: finalCanonical,
          priceCurrency: currency,
          price: price,
          availability: availability === 'out of stock' 
            ? 'https://schema.org/OutOfStock' 
            : 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition'
        }
      };
      scriptTag.textContent = JSON.stringify(schemaData);
    } else {
      // Remove product schema if leaving product page
      const existingScript = document.querySelector('script#product-schema-jsonld');
      if (existingScript) existingScript.remove();
    }
  }, [title, description, image, url, canonicalUrl, price, currency, availability, type, siteName, noIndex]);

  return null;
}

