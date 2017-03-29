#!/usr/bin/env php
<?php
// ./buildshares.php > ../application/views/scripts/index/partials/share_list.phtml
/**
 * Generates all docs based on api pod descriptions
 */
$baseDir = realpath(dirname(__FILE__) . '/docbuilder');
//$outPath = $baseDir . '/cache';
$outPath = realpath($baseDir . '/../../application/views/scripts/docs/partials/pods');

$actionTpl = file_get_contents($baseDir . '/pod_action.phtml');
$containerTpl = file_get_contents($baseDir . '/pod_container.phtml');
// master pod overview
$masterTpl = file_get_contents($baseDir . '/pod_master.phtml');

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

Zend_Rest_Client::getHttpClient()->setAuth('m', '44f8ffc19adbd184f74b06cfcd9cccd6');
$bipClient = new Zend_Rest_Client('https://api.bip.io');


try {
  $r = $bipClient->restGet('/rpc/bip/share/list');
  $rp = $bipClient->restGet('rpc/describe/pod');
} catch (Exception $e) {
  var_dump($e);
  exit;
}

$body = json_decode($r->getBody(), TRUE);
$pods = json_decode($rp->getBody(), TRUE);

//var_dump($body);

//var_dump($pods);

$imgBase = 'https://bip.io/static/img/channels/32/color/';
$c = 1;

foreach ($body['data'] as $share) {
  $leader = 'bip_' . $share['type'] . '.png';
  
  if (isset($share['config']) && isset($share['config']['channel_id'])) {

    $tokens = explode('.', $share['config']['channel_id']);
    $leader = $tokens[0] . '.png';

  }
 
  ?>
  <div class="span5 <?php echo ( ($c % 2 == 0) ? 'offset1' : ''); ?> shared-bip-container">
      <div class="row">
        <div class="bip-summary-container" style="width: 110px;
          margin-left: 40px;
          float: left;">
          
        <div class="bip-summary middle">
          <img class="tooltipped" data-placement="top" title="" src="<?php echo $imgBase . $leader?>">
          <div class="shared-bip-list">          
            <?php for ($i = 0; $i < count($share['manifest']); $i++) {               
              $manifest = $share['manifest'][$i];
              $tokens = explode('.', $manifest);

              $action = $pods[$tokens[0]]['actions'][$tokens[1]];
              
              $manifestImg = $imgBase . $tokens[0] . '.png';
              
              ?>
              <img class="mini tooltipped" data-placement="top" title="" 
                   src="<?php echo $manifestImg; ?>" 
                   data-original-title="<?php echo $action['description'] ?> : <?php echo $action['description_long'] ?> ">          
            <?php } ?>  
          </div>
          </div>                         
          
          <div>
            via <img class="user-avatar mini" src="https://bip.io/static/img/cdn/av/<?php echo $share['owner_id']; ?>.jpg" alt="">
            <?php echo $share['owner_name']; ?>
          </div>
          
        </div>
        <div>
          <label>            
            <?php echo $share['name']; ?>
          </label>
          <div class="share-bip-description">              
            <p><?php echo $share['note']; ?></p>             
          </div>
        </div>        
      </div>
    </div>
<?
  $c++;
}