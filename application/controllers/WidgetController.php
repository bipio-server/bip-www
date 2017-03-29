<?php

class WidgetController extends Zend_Controller_Action {

	public function indexAction() {
		if (DEV_ENVIRONMENT) {
			$this->_helper->_layout->setLayout('widget');
		} else {
			$this->_helper->_layout->setLayout('build/widget');
		}

		$r = $this->getRequest();
		$dict = json_decode(base64_decode($r->getParam('payload')));
		$limit = 8;
		$dict->normedManifest = Array();

		foreach ($dict->manifest as $edge) {
			if (!($dict->type == "trigger" && $edge == $dict->config->channel_id)) {
				array_push( $dict->normedManifest, array("action" => $edge, "title" => "this is title"));
			}
	   }

		$distribution = array_pad(array(), $limit, array());
		$numElements = count($dict->normedManifest);
		$maxDeg = 360;
		$angle = 0;
		$deg = $maxDeg / count($distribution);
		$offs = 0;
		$step = $maxDeg / $numElements;

		for ($i = 0; $i < $numElements; $i++) {
			$offs = floor($angle / $deg);
			$distribution[$offs] = $dict->normedManifest[$i];
			$angle += $step;
			if ($angle > $maxDeg) {
				$angle = 45;
			}
		}

		$dict->normedManifest = $distribution;

		if (isset($dict->config->config->icon)) {
			$dict->icon = $dict->config->config->icon;
		}
		elseif ($dict->type != "trigger") {
			$dict->icon = "/static/img/channels/32/color/bip_".$dict->type.".png";
		}
		elseif (isset($dict->config->channel_id)) {
			$tokens = explode(".", $dict->config->channel_id);
			$dict->icon = "/static/img/channels/32/color/".$tokens[0].".png";
		}

		$this->view->data = $dict;
    $this->view->nonce = $_SESSION['_nonce'] = Bip_Utility::uuidV4();
	}

}