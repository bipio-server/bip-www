#!/usr/bin/env php
<?php
/**
 * Installs the bip database and authentication collections if they do not exist,
 * and sets up a locally authenticated user which can talk to the staging API
 */

$opts = getopt("p:");

//$optKeys = array('u','p','e');
$optKeys = array('p');

foreach ($optKeys as $key) {
    if (!isset($opts[$key])) {
        echo "Creates a local user record which can interact with the staging API";
        // echo "Usage: ./install.php -u {username} -p {password} -e {email address}";
        echo "Usage: ./install.php -p {password}";
        exit();
    }
}

$username = $opts['u'];
$password = $opts['p'];
$email = 'nop';

// Define path to application directory
defined('APPLICATION_PATH')
    || define('APPLICATION_PATH', realpath(dirname(__FILE__) . '/../application'));

// Define application environment
defined('APPLICATION_ENV')
    || define('APPLICATION_ENV', (getenv('APPLICATION_ENV') ? getenv('APPLICATION_ENV') : 'development'));

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

$config = Zend_Registry::get('config');
$options = $config->toArray();

$mongoOptions = $options['resources']['mongo'];

$mongoDsn = sprintf('mongodb://%s:%s/%s',
                $mongoOptions['hostname'],
                27017,
                $mongoOptions['databasename']);

$mongo = new Mongo($mongoDsn, array('connect' => true));
$mongo->connect();

$db = $mongo->selectDb($mongoOptions['databasename']);

// create database
$collections = $db->listCollections();

if (!empty($collections)) {
    // don't run twice until we can fix some bugs with dup channels + local records
    echo "setup already done \n";
    exit;
}

$db->createCollection('dc_graphs');

$accountId = '5d5579ea-86a3-4d1d-b088-bb3e3e783ff6';

// -------------------------------------------------------------- REMOTE CHANNEL

// install channel for this user on staging
$channel = array(
  "name" => $username . ' Email',
  "action"  => "email.smtp_forward",
  "config" => array ("rcpt_to" => $email),
  'note' => 'Dev User Default channel'
 );

Zend_Rest_Client::getHttpClient()->setAuth('dev', $options['api']['key']);
$bipClient = new Zend_Rest_Client($options['api']['host']);

try {
    $r = $bipClient->restPost('/api/rest/channel', $channel);
} catch (Exception $e) {
    var_dump($e);
    exit;
}

$body = json_decode($r->getBody(), TRUE);
$channelId = $body['id'];

// ---------------------------------------------------------------- OPTIONS

// install dev account options locally, using this users default channel
$localOpts = array(
  "bip_config"=> array(),
  "bip_hub"=> array(
    array(
      "channel"=> $channelId,
      "transform"=> "system"
    )
  ),
  "bip_domain_id"=> "822b8a29-aac9-43a2-a87d-51192da02db4",
  "bip_end_life"=> array(
    "imp"=> 50,
    "time"=> "+7d"
  ),
  "bip_type"=> "smtp",
  "id"=> "cf2912c0-1dfb-11e2-8f71-40402912c360",
  "owner_id"=> $accountId,
  "timezone"=> "EST",
  "avatar"=> ""
);

$db->createCollection('account_options');
$collection = $db->selectCollection('account_options');
$collection->save($localOpts);

// ---------------------------------------------------------------- ACCOUNTS
//
// create account collections
$account = array(
    'email_account' => $email,
    'account_level' => 'user',
    'name' => 'dev user',
    'username' => 'dev',
    'id' => $accountId

);
$db->createCollection('accounts');
$collection = $db->selectCollection('accounts');
$collection->save($account);


// ---------------------------------------------------------------- AUTHS

$accountAuths = array(
    'id' => 'c6222072-1dfb-11e2-8f71-40402912c360',
    'owner_id' => $accountId,
    'password' => Bip_Utility_Crypt::hash($password),
    'type' => 'login_primary',
    'username' => 'dev'

);

$db->createCollection('account_auths');
$collection = $db->selectCollection('account_auths');
$collection->save($accountAuths);

// -----------------------------------------------------------------------------
echo "done \n";