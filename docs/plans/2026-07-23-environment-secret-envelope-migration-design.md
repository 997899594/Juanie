# Environment Secret Envelope Migration

## Problem

Historical `environmentVariable` secrets were encrypted with the automatically generated
`juanie-master-key/masterKey`. The durable control-plane migration introduced
`ENCRYPTION_MASTER_KEY`, but did not record a key version on environment-variable envelopes or
re-encrypt the historical rows. Runtime decryption therefore used the new key against old
ciphertext and failed during releases.

## Design

Environment-variable envelopes become versioned records. Every secret row stores
`encryptionKeyVersion`, and its stable record ID is authenticated as AES-GCM additional
authenticated data. New writes generate the row ID before encryption and persist the ciphertext,
IV, authentication tag, and key version together.

The migration follows expand, migrate, contract:

1. Expand adds the nullable key-version column. The schema runner loads the legacy key only from
   `juanie-master-key/masterKey`, decrypts every unversioned envelope, and re-encrypts it with the
   current key and record-bound AAD. Rows already written by the N-1 runtime with the current key
   are detected through authenticated decryption and are re-encrypted in the same format.
2. The new runtime writes only versioned envelopes. During the N-1 rollback window it can read an
   unversioned current-key envelope without AAD; it never falls back to the legacy key.
3. Contract reruns migration, requires the key version in the database invariant, removes the
   transitional read path and legacy key mount, and deletes `juanie-master-key` after production
   verification.

Migration is fail-closed: if neither the current nor explicit legacy migration key authenticates a
row, the schema job fails and Helm does not roll out the application. Kubernetes workload Secrets
are not used as a recovery source and never become authoritative control-plane state.

## Verification

- Unit tests cover AAD binding, key-version reads, and the temporary N-1 envelope shape.
- Migration tests assert the expand/contract ordering and Helm tests assert the legacy key is
  mounted only into the expand schema runner.
- Production verification requires zero secret rows with a null key version before contract.
- NexusNote is rebuilt and released only after Juanie contract deployment is healthy.
