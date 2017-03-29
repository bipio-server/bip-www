<?php
/**
 * General utilities
 */
class Bip_Utility {

    static function uuidV4() {
        // Use the PECL uuid implementation if we have one
        if (function_exists('uuid_create') && defined('UUID_TYPE_RANDOM')) {
            return uuid_create(UUID_TYPE_RANDOM);
        } else {
            // version 4 UUID
            return sprintf('%08x-%04x-%04x-%02x%02x-%012x', mt_rand(), mt_rand(0, 65535), bindec(substr_replace(sprintf('%016b', mt_rand(0, 65535)), '0100', 11, 4)), bindec(substr_replace(sprintf('%08b', mt_rand(0, 255)), '01', 5, 2)), mt_rand(0, 255), mt_rand());
        }
    }

    /**
     *
     * @param <type> $minLen
     * @param <type> $maxLen
     * @param <type> $hash
     * @param <type> $charset
     * @return <type> 
     */
    static function randStr($minLen = 0, $maxLen = 64, $rand = true, $hash = false, $charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~!@#$%^&*()_+=-`[{]}\|<>,.?/') {
        $str = '';
        $count = strlen($charset);
        $length = $rand ? rand($minLen, $maxLen) : $maxLen;
        while (--$length >= 0) {
            $str .= $charset[mt_rand(0, $count - 1)];
        }
        return $str;
    }
    
}