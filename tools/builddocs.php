#!/usr/bin/env php
<?php
/**
 * Generates all docs based on api pod descriptions
 */
$buffering = false;
$buffering = true;

// error_reporting(E_NOTICE);

$baseDir = realpath(dirname(__FILE__) . '/docbuilder');
//$outPath = $baseDir . '/cache';
$outPath = realpath($baseDir . '/../../application/views/scripts/docs/partials/pods');

$actionTpl = file_get_contents($baseDir . '/pod_action.phtml');
$eventTpl = file_get_contents($baseDir . '/pod_action.phtml');
$containerTpl = file_get_contents($baseDir . '/pod_container.phtml');
$integrationTpl = file_get_contents($baseDir . '/pod_integrations.phtml');

// master pod overview
$masterTpl = file_get_contents($baseDir . '/pod_master.phtml');
$premiumTpl = file_get_contents($baseDir . '/pod_premium.phtml');
$communityTpl = file_get_contents($baseDir . '/pod_community.phtml');

// Define path to application directory
defined('APPLICATION_PATH')
        || define('APPLICATION_PATH', realpath(dirname(__FILE__) . '/../application'));

// Define application environment
defined('APPLICATION_ENV')
        || define('APPLICATION_ENV', (getenv('APPLICATION_ENV') ? getenv('APPLICATION_ENV') : 'michael'));

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

Zend_Rest_Client::getHttpClient()->setAuth($options['api']['wf']['username'], $options['api']['wf']['key']);
$bipClient = new Zend_Rest_Client($options['api']['wf']['host']);

//Zend_Rest_Client::getHttpClient()->setAuth('mjp', 'p1nst3ppa');
//$bipClient = new Zend_Rest_Client('http://local.bip.io:5000');

try {
  $r = $bipClient->restGet('/rpc/describe/pod');
  $plansResponse = $bipClient->restGet('/rpc/permissions/plans');
  $plans = json_decode($plansResponse ->getBody(), TRUE);
} catch (Exception $e) {
  var_dump($e);
  exit;
}

$body = json_decode($r->getBody(), TRUE);

// production integrations
Zend_Rest_Client::getHttpClient()->setAuth($options['api']['wf']['username'], $options['api']['wf']['key']);
$bipProdClient = new Zend_Rest_Client($options['api']['wf']['host']);

//Zend_Rest_Client::getHttpClient()->setAuth('mjp', 'p1nst3ppa');
//$bipProdClient = new Zend_Rest_Client('http://local.bip.io:5000');

function prettyPrint($json) {
  $result = '';
  $level = 0;
  $prev_char = '';
  $in_quotes = false;
  $ends_line_level = NULL;
  $json_length = strlen($json);

  for ($i = 0; $i < $json_length; $i++) {
    $char = $json[$i];
    $new_line_level = NULL;
    $post = "";
    if ($ends_line_level !== NULL) {
      $new_line_level = $ends_line_level;
      $ends_line_level = NULL;
    }
    if ($char === '"' && $prev_char != '\\') {
      $in_quotes = !$in_quotes;
    } else if (!$in_quotes) {
      switch ($char) {
        case '}': case ']':
          $level--;
          $ends_line_level = NULL;
          $new_line_level = $level;
          break;

        case '{': case '[':
          $level++;
        case ',':
          $ends_line_level = $level;
          break;

        case ':':
          $post = " ";
          break;

        case " ": case "\t": case "\n": case "\r":
          $char = "";
          $ends_line_level = $new_line_level;
          $new_line_level = NULL;
          break;
      }
    }
    if ($new_line_level !== NULL) {
      $result .= "\n" . str_repeat("  ", $new_line_level);
    }
    $result .= $char . $post;
    $prev_char = $char;
  }

  return $result;
}

function getDescription($action) {
  global $body;

  $description = array();
  $tokens = explode('.', $action);
  $sPod = $tokens[0];
  $sAction = $tokens[1];

  foreach ($body as $podName => $pod) {
    if ($podName == $sPod) {
      array_push($description, $pod['title']);
      foreach ($pod['actions'] as $actionName => $action) {
        if ($actionName == $sAction) {
          array_push($description, $action['title']);
          break 2;
        }
      }
    }
  }
//  var_dump($description);exit;
  return $description;
}

function distributeManifest($dict, $limit) {
  $distribution = array_pad(array(), $limit, array());
  $numElements = count($dict['normedManifest']);
  $maxDeg = 360;
  $angle = 0;
  $deg = $maxDeg / count($distribution);
  $offs = 0;
  $step = $maxDeg / $numElements;

  for ($i = 0; $i < $numElements; $i++) {
    $offs = floor($angle / $deg);
    $distribution[$offs] = $dict['normedManifest'][$i];
    $angle += $step;
    if ($angle > $maxDeg) {
      $angle = 45;
    }
  }

  $dict['normedManifest'] = $distribution;
//var_dump($distribution);exit;
  return $dict;
};

function isPremiumPod($podName) {
  global $plans;
  return (in_array($podName, $plans['user']['pod_exclusions']));
}


$body = new ArrayObject($body);
$body->ksort();

$podList = '';
$premiumPodList = '';
$communityPodList = '';

$max = 6;

$idx = 0;
$offset = '';
$track = 0;

foreach ($body as $podName => $pod) {
  if ('profile' === $podName || 'hall' === $podName || 'kato' === $podName) {
    continue;
  }

  $description = ($pod['title']);

  if ($track >= $max) {
    $track = 0;
    if ($max == 6) {
//      $max = 4;
      $max = 6;
    } else {
      $max = 6;
    }
    $podList .= '</div>';
  }

  if (0 === $track) {
    $podList .= '<div class="row">';
//    $offset = ' offset' . ($max === 5 ? 1 : 2);
  }

  $proBox = '';

  $podSnippet = <<<PODTEMPLATE
<div class="span2 pod-select $offset" data-pod="$podName">
                <div class="hub ">
                    <a href="/docs/pods/${podName}">
                      <img src="/static/img/channels/32/color/$podName.png" alt="" class="hub-icon hub-icon-32">
                      <strong class="name">$description</strong>
                      <span class="note"></span>
                    </a>
                </div>
            </div>
PODTEMPLATE;

  if (isPremiumPod($podName)) {
    $proBox = '<div class="pro-box"><div class="ribbon"><span>premium</span></div></div>';
    $premiumPodList .= $podSnippet;
  } else {
    $communityPodList .= $podSnippet;
  }

  // master snippet
  $podSnippet = <<<PODTEMPLATE
<div class="span2 pod-select $offset" data-pod="$podName">
                <div class="hub ">
                    <a href="/docs/pods/${podName}">
                      ${proBox}
                      <img src="/static/img/channels/32/color/$podName.png" alt="" class="hub-icon hub-icon-32">
                      <strong class="name">$description</strong>
                      <span class="note"></span>
                    </a>
                </div>
            </div>
PODTEMPLATE;

  $podList .= $podSnippet;

  $offset = '';
  $track++;
}
$podList .= '</div>';

/*
foreach ($body as $podName => $pod) {
  $description = ($pod['title']);
  $podList .= <<<PODTEMPLATE
<div class="span2 pod-select" data-pod="$podName">
                <div class="hub ">
                    <a href="/docs/pods/${podName}">
                        <img src="/static/img/channels/32/color/$podName.png" alt="" class="hub-icon hub-icon-32">
                        <strong class="name">$description</strong>
                        <span class="note"></span>
                    </a>
                </div>
            </div>
PODTEMPLATE;
}
*/

//$podList = '';
foreach ($body as $podName => $pod) {
  if ('profile' === $podName || 'hall' === $podName || 'kato' === $podName) {
    continue;
  }
  $description = ($pod['title']);
  $url = $pod['url'];
  $descriptionLong = (isset($pod['description']) ? $pod['description'] : $pod['title']);
  $authType = $pod['auth']['strategy'];
  $authUrl = '';
  if ($authType && $authType !== 'none') {
    $authUrl = '/' . implode('/', array_slice(explode('/', $pod['auth']['_href']), 3));
    if (isset($pod['auth']) && isset($pod['auth']['authMap'])) {
      $authMap = array();
      foreach ($pod['auth']['authMap'] as $local => $remote) {
        array_push($authMap, $local . '={' . $remote . '}');
      }
      if (!empty($authMap)) {
        $authUrl .= '?' . implode('&', $authMap);
      }
    }
  }

  $actionContent = '';
  $doc = '';

  if ($buffering)
    ob_start();

  $firstAction = true;
  foreach ($pod['actions'] as $actionName => $action) {
    $actionDescriptionLong = htmlentities(isset($action['description']) ? $action['description'] : $action['title']);
    $actionDescription = htmlentities($action['title']);
    $configRows = '';

    //$singleton = $action['singleton'];
    $trigger = ('invoke' !== $action['trigger']);

    if (!$trigger) {

      $configSample = array(
          "action" => $podName . '.' . $actionName,
          "config" => array()
      );

      if (isset($action['config']['properties'])) {

        foreach ($action['config']['properties'] as $opt => $schema) {
          $configSample['config'][$opt] = $schema['type'] === "boolean" ? "yes" : "value";
          $configRows .= "<tr><td><em>" . $opt . "</em></td>\n";
          $configRows .= "<td>" . $schema['type'] . "</td>\n";
          $configRows .= "<td>" . (isset($schema['title']) ? $schema['title'] : '') . "</td>";
          $configRows .= "<td>" . (isset($schema['default']) ? $schema['default'] : 'none') . "</td></tr>\n\n";
          /*
           * eg
            <td>String, <a href="http://en.wikipedia.org/wiki/Path_(computing)#Unix_style">Unix style path format</a> </td>
            <td>Target folder for received file
            <br/><br/>eg: <code>/usual/place</code></td>
           *
           */
        }
      }

      $configSample = prettyPrint(json_encode($configSample));

      $importRows = '';
      if (isset($action['imports']['properties'])) {
        foreach ($action['imports']['properties'] as $opt => $schema) {
          $importRows .= "<tr><td><em>" . $opt . "</em></td>\n";
          $importRows .= "<td>" . (isset($schema['type']) ? $schema['type'] : 'string') . "</td>\n";
          $importRows .= "<td>" . (isset($schema['title']) ? $schema['title'] : '') . "</td>";
          $importRows .= "<td>" . (isset($schema['default']) ? $schema['default'] : 'none') . "</td></tr>\n\n";
        }
      }

      $exportRows = '';
      if (isset($action['exports']['properties'])) {
        foreach ($action['exports']['properties'] as $opt => $schema) {
          $exportRows .= "<tr><td><em>" . $opt . "</em></td>\n";
          $exportRows .= "<td>" . (isset($schema['type']) ? $schema['type'] : 'string') . "</td>\n";
          $exportRows .= "<td>" . (isset($schema['title']) ? $schema['title'] : '') . "</td></tr>\n\n";
        }
      }

      $renderRows = '';
  //    var_dump(isset($action['renderers']) && count($action['renderers']) > 0);
  //    exit;
      if (isset($action['renderers']) && count($action['renderers']) > 0) {
        foreach ($action['renderers'] as $endpoint => $def) {
          $renderRows .= "<tr><td><em>" . $def['description'] . "</em></td>\n";
          $renderRows .= "<td>" . (isset($def['contentType']) ? $def['contentType'] : '') . "</td>\n";
          $renderRows .= "<td>https://<code>username</code>.bip.io/rpc/" . ( isset($def['scope']) && $def['scope'] === 'pod' ? 'pod' : 'render') . "/" .
                  (isset($def['scope']) && $def['scope'] === 'pod' ? '' : 'channel/' ) .
                  (isset($def['scope']) && $def['scope'] === 'pod' ? ($podName . '/' . $actionName) : "<code>channel_id</code>" ) .
                  "/" .
                  $endpoint . "</td></tr>\n\n";
        }
      }


      eval(' ?>' . $actionTpl . '<?php ');

      $firstAction = false;
    }
  }

  $actionContent = ob_get_clean();

  $eventContent = '';
  $doc = '';

  if ($buffering)
    ob_start();

  $firstAction = true;
  foreach ($pod['actions'] as $actionName => $action) {
    $actionDescriptionLong = htmlentities(isset($action['description']) ? $action['description'] : $action['title']);
    $actionDescription = htmlentities($action['title']);
    $configRows = '';

    //$singleton = $action['singleton'];
    $trigger = ('invoke' !== $action['trigger']);

    if ($trigger) {

      $configSample = array(
          "action" => $podName . '.' . $actionName,
          "config" => array()
      );

      if (isset($action['config']['properties'])) {

        foreach ($action['config']['properties'] as $opt => $schema) {
          $configSample['config'][$opt] = $schema['type'] === "boolean" ? "yes" : "value";
          $configRows .= "<tr><td><em>" . $opt . "</em></td>\n";
          $configRows .= "<td>" . $schema['type'] . "</td>\n";
          $configRows .= "<td>" . (isset($schema['title']) ? $schema['title'] : '') . "</td>";
          $configRows .= "<td>" . (isset($schema['default']) ? $schema['default'] : 'none') . "</td></tr>\n\n";
          /*
           * eg
            <td>String, <a href="http://en.wikipedia.org/wiki/Path_(computing)#Unix_style">Unix style path format</a> </td>
            <td>Target folder for received file
            <br/><br/>eg: <code>/usual/place</code></td>
           *
           */
        }
      }

      $configSample = prettyPrint(json_encode($configSample));

      $importRows = '';
      if (isset($action['imports']['properties'])) {
        foreach ($action['imports']['properties'] as $opt => $schema) {
          $importRows .= "<tr><td><em>" . $opt . "</em></td>\n";
          $importRows .= "<td>" . (isset($schema['type']) ? $schema['type'] : 'string') . "</td>\n";
          $importRows .= "<td>" . (isset($schema['title']) ? $schema['title'] : '') . "</td>";
          $importRows .= "<td>" . (isset($schema['default']) ? $schema['default'] : 'none') . "</td></tr>\n\n";
        }
      }

      $exportRows = '';
      if (isset($action['exports']['properties'])) {
        foreach ($action['exports']['properties'] as $opt => $schema) {
          $exportRows .= "<tr><td><em>" . $opt . "</em></td>\n";
          $exportRows .= "<td>" . (isset($schema['type']) ? $schema['type'] : 'string') . "</td>\n";
          $exportRows .= "<td>" . (isset($schema['title']) ? $schema['title'] : '') . "</td></tr>\n\n";
        }
      }

      $renderRows = '';
  //    var_dump(isset($action['renderers']) && count($action['renderers']) > 0);
  //    exit;
      if (isset($action['renderers']) && count($action['renderers']) > 0) {
        foreach ($action['renderers'] as $endpoint => $def) {
          $renderRows .= "<tr><td><em>" . $def['description'] . "</em></td>\n";
          $renderRows .= "<td>" . (isset($def['contentType']) ? $def['contentType'] : '') . "</td>\n";
          $renderRows .= "<td>https://<code>username</code>.bip.io/rpc/" . ( isset($def['scope']) && $def['scope'] === 'pod' ? 'pod' : 'render') . "/" .
                  (isset($def['scope']) && $def['scope'] === 'pod' ? '' : 'channel/' ) .
                  (isset($def['scope']) && $def['scope'] === 'pod' ? ($podName . '/' . $actionName) : "<code>channel_id</code>" ) .
                  "/" .
                  $endpoint . "</td></tr>\n\n";
        }
      }

      eval(' ?>' . $actionTpl . '<?php ');

      $firstAction = false;
    }
  }

  $eventContent = ob_get_clean();

//  exit;
//$buffering = false;
  if ($buffering)
    ob_start();

  // get prod integrations
  try {
//var_dump(Array('filter' => 'manifest:' . $podName ));
    $ir = $bipProdClient->restGet("/rpc/bip/share/list", Array('filter' => 'manifest:' . $podName ));
  } catch (Exception $e) {
    var_dump($e);
    exit;
  }

  $iBody = json_decode($ir->getBody(), TRUE);
//var_dump($iBody);exit;
  $integrations = '';
  foreach ($iBody['data'] as $s) {
    $srcName = $s['type'] === 'trigger' ? array_shift(explode('.', $s['config']['channel_id'])) : 'bip_' . $s['type'];

    $ownerId = $s['owner_id'];
    $ownerName = $s['owner_name'];
    $shareId = $s['id'];
    $shareName = $s['name'];
    $shareNote = $s['note'];

    // source description
    //$shareSrcDesc = $s['type'] === 'trigger' ? getDescription($s['config']['channel_id']) : 'type bip';
    $shareSrcDesc = '';
    if ($s['type'] === 'trigger') {
      $tokens = getDescription($s['config']['channel_id']);
      $shareSrcDesc = $tokens[0] . ': ' . $tokens[1];
    } else if ($s['type'] === 'smtp') {
      $shareSrcDesc = 'Email Address';
    } else if ($s['type'] === 'http') {
      $shareSrcDesc = 'Web Hook';
    }

    $s['normedManifest'] = Array();

    foreach ($s['manifest'] as $edge) {
      array_push(
          $s['normedManifest'],
          array(
            "action" => $edge,
            "title" => "this is title"
          )
        );
    }

    $nm = distributeManifest($s, 8);
    $normedManifest = $nm['normedManifest'];

    $share = $s;

    eval('?>' . $integrationTpl . '<?php ');
  }

  $integrations = ob_get_clean();

  if ($buffering)
    ob_start();

  eval(' ?>' . $containerTpl . '<?php ');

  $doc = ob_get_clean();

  file_put_contents($outPath . '/' . $podName . '.phtml', $doc);
}

// MASTER POD LIST
if ($buffering)
  ob_start();

eval(' ?>' . $masterTpl . '<?php ');
$masterDoc = ob_get_clean();

file_put_contents($outPath . '/../pods.phtml', $masterDoc);

// PREMIUM POD LIST
if ($buffering)
  ob_start();

eval(' ?>' . $premiumTpl . '<?php ');
$masterDoc = ob_get_clean();

file_put_contents($outPath . '/../pods_premium.phtml', $masterDoc);

// COMMUNITY POD LIST
if ($buffering)
  ob_start();

eval(' ?>' . $communityTpl . '<?php ');
$masterDoc = ob_get_clean();

file_put_contents($outPath . '/../pods_community.phtml', $masterDoc);
// write out working schema
file_put_contents(__DIR__ . '/../application/configs/schemas.json', $r->getBody());

