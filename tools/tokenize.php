#!/usr/bin/env php
<?php
/**
 * Encrypts a token for an environment
 */

$opts = getopt("t:e:");


$optKeys = array('t', 'e');

foreach ($optKeys as $key) {
    if (!isset($opts[$key])) {
        echo "Generates an encrypted token for a given environment";
        echo "Usage: ./tokenize.php -t {token} -e [staging|development|production]";
        exit();
    }
}

$token = $opts['t'];
$env = $opts['e'];

// Define path to application directory
defined('APPLICATION_PATH')
    || define('APPLICATION_PATH', realpath(dirname(__FILE__) . '/../application'));

// Define application environment
define('APPLICATION_ENV', $env);

// Ensure library/ is on include_path
set_include_path(implode(PATH_SEPARATOR, array(
    realpath(APPLICATION_PATH . '/../library'),
    get_include_path(),
)));

/** Zend_Application */
require_once 'Zend/Application.php';

// Create application, bootstrap, and run
$application = new Zend_Application(
    APPLICATION_ENV,
    APPLICATION_PATH . '/configs/application.ini'
);

$application->bootstrap();

// -----------------------------------------------------------------------------
echo Bip_Utility_Crypt::aesEncrypt($token)."\n";
