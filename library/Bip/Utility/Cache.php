<?php
// DEPRECATED.
class Bip_Utility_Cache {

  CONST REMOTE_CACHE = 'remote';
  CONST LOCAL_CACHE = 'local';
  CONST NONE_CACHE = 'none';

  public function __construct(Zend_Config $cacheConfig, Zend_Log $generalLogger, Zend_Log $cacheLogger) {
  }
}