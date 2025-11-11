public with sharing class AuraErrorUtil {
    /**
     * Throws an exception suitable for Aura/LWC error handling.
     * This ensures components receive user-friendly errors.
     */
    public static void throwAuraOrIllegal(String message) {
        throw new IllegalArgumentException(message);
    }
}