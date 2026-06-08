import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockUpload,
  mockGetPublicUrl,
  mockRemove,
  mockCreateSignedUrl,
  mockClient,
  mockEnv,
  mockLogger,
} = vi.hoisted(() => {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  const remove = vi.fn();
  const createSignedUrl = vi.fn();
  const client = {
    storage: {
      from: vi.fn(() => ({
        upload,
        getPublicUrl,
        remove,
        createSignedUrl,
      })),
    },
  };

  return {
    mockUpload: upload,
    mockGetPublicUrl: getPublicUrl,
    mockRemove: remove,
    mockCreateSignedUrl: createSignedUrl,
    mockClient: client,
    mockEnv: {
      isSupabaseServiceConfigured: true,
      requireSupabaseServiceEnv: vi.fn(() => ({ url: 'https://example.supabase.co', serviceKey: 'service-key' })),
    },
    mockLogger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('../logger', () => ({ logger: mockLogger }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}));

vi.mock('../supabase/env', () => mockEnv);

import { uploadToSupabase, deleteFromSupabase, getSupabaseSignedUrl } from '../supabase-storage';

describe('supabase-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.isSupabaseServiceConfigured = true;
    mockEnv.requireSupabaseServiceEnv = vi.fn(() => ({ url: 'https://example.supabase.co', serviceKey: 'service-key' }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  /**
   * Happy path: uploads a buffer and returns the public URL metadata.
   * Verifies the Supabase client is called and the resolved URL is surfaced.
   */
  it('uploads a file (happy path)', async () => {
    mockUpload.mockResolvedValueOnce({ error: null });
    mockGetPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://public.url/file.png' } });

    const result = await uploadToSupabase(Buffer.from('data'), 'folder', { fileName: 'file.png' });

    expect(mockClient.storage.from).toHaveBeenCalledWith('images');
    expect(mockUpload).toHaveBeenCalled();
    expect(result.url).toBe('https://public.url/file.png');
    expect(result.public_id).toContain('folder/file');
  });

  /**
   * Happy path: creates a signed URL for a private asset and returns it.
   * Ensures the Supabase signed URL helper is invoked with path and expiry.
   */
  it('returns signed URL (happy path)', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: { signedUrl: 'https://signed.url' }, error: null });

    const signedUrl = await getSupabaseSignedUrl('path/to/file.png', 600);

    expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.png', 600);
    expect(signedUrl).toBe('https://signed.url');
  });

  /**
   * Happy path: deletes a file and returns true on success.
   * Confirms the storage remove call receives the expected path array.
   */
  it('deletes a file (happy path)', async () => {
    mockRemove.mockResolvedValueOnce({ error: null });

    const deleted = await deleteFromSupabase('path/to/file.png');

    expect(mockRemove).toHaveBeenCalledWith(['path/to/file.png']);
    expect(deleted).toBe(true);
  });

  /**
   * Edge case: when Supabase service env is missing, upload should throw.
   * Simulates missing configuration by toggling the env mock to throw.
   */
  it('throws when storage is not configured (edge case)', async () => {
    mockEnv.isSupabaseServiceConfigured = false;
    mockEnv.requireSupabaseServiceEnv = vi.fn(() => { throw new Error('Supabase service client is not configured'); });

    const { uploadToSupabase: upload } = await import('../supabase-storage');

    await expect(upload(Buffer.from('data'))).rejects.toThrow('Supabase storage is not configured');
  });

  /**
   * Edge case: upload rejects when Supabase returns an error object.
   * Ensures the error message is propagated to the caller.
   */
  it('bubbles upload error (edge case)', async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: 'fail' } });

    await expect(uploadToSupabase(Buffer.from('data'))).rejects.toThrow('Upload failed: fail');
  });

  /**
   * Edge case: delete returns false when storage remove fails.
   * Verifies failure path returns a boolean false indicator.
   */
  it('returns false on delete error (edge case)', async () => {
    mockRemove.mockResolvedValueOnce({ error: { message: 'delete fail' } });

    const deleted = await deleteFromSupabase('bad-path');

    expect(deleted).toBe(false);
  });

  /**
   * Edge case: signed URL generation throws when Supabase returns an error.
   * Ensures the error is surfaced to the caller with the Supabase message.
   */
  it('throws on signed URL error (edge case)', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'signed url fail' } });

    await expect(getSupabaseSignedUrl('file')).rejects.toThrow('Failed to get signed URL: signed url fail');
  });
});
